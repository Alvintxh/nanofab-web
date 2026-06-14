# Changelog

## 2026-06-14 - 收尾：动态出题/论文接入客户端 RAG + 拆除 pgvector 云端设施

承接客户端 hybrid 检索，按 2→3→1 完成迁移与清理：

**2 动态出题脱离 pgvector**
- `generate-quiz` 改为从请求体读 `material`（教材原文），移除 `knowledge_chunks` 查询（仍保留鉴权）
- `js/quiz.js` 新增 `_buildQuizMaterial`：从 `knowledge_index.json` 取该章小节拼接接地，索引缺失时回退当前章 DOM 正文

**3 每周论文接入客户端索引**
- `scripts/lib/local-embed.mjs`：共享本地 bge 嵌入(Transformers.js + 镜像)；`build-embeddings.mjs` 一并复用，单一模型源
- `scripts/ingest-papers.mjs` 重写：本地 bge 嵌入、按 token 去重累积、写 `content/papers_index.json`（不再用 Supabase）；实测抓取→嵌入→落盘打通
- `.github/workflows/ingest-papers.yml`：本地嵌入 + 提交 `papers_index.json` 回仓库（`contents: write`），去掉 Supabase 依赖
- `js/retriever.js`：同时加载教材 + 论文索引并融合进 BM25/dense；refs 带 `url`/`sourceType`，论文引用渲染为外链角标

**1 拆除闲置云端设施**
- 删函数 `knowledge-search`、`ingest-admin`；删 secret `EMBEDDING_*`、`ADMIN_INGEST_SECRET`（保留 `ZHIPU_API_KEY` 供 chat/出题/论文摘要）
- migration `20260614020000_drop_knowledge_vectors.sql`：drop `knowledge_chunks` 表与 `match_knowledge`（已应用）
- 删除闲置脚本/文件：`ingest-textbook.mjs`、`post-ingest.mjs`、`lib/store.mjs`、`lib/embed.mjs`、`_shared/embed.ts`；package.json 去掉 `@supabase/supabase-js` 与 `ingest:textbook`
- 现存云端：仅 `ai-proxy`(chat) + `generate-quiz`(出题)；检索/嵌入 100% 客户端、免费、零 key


## 2026-06-14 - 检索改为纯客户端 Hybrid（BM25 + 本地 bge），零 API/零成本

借鉴课程 RAG 方法论，把检索从"付费/需 key 的云端嵌入(智谱/Gemini + pgvector)"改为**全部浏览器端、免费、无需任何 key**：

- `scripts/build-embeddings.mjs`：用本地 sentence-transformers **bge-small-zh-v1.5**(Transformers.js) 把 236 节教材嵌入，产出静态 `content/knowledge_index.json`(1.1MB, 512 维)。国内默认走 `hf-mirror.com` 镜像(`HF_ENDPOINT` 可覆盖)
- `js/retriever.js`(新模块)：客户端 **Hybrid 检索** = BM25(Intl.Segmenter 分词，立即可用) + bge 稠密(Transformers.js 浏览器端嵌入) → **RRF 融合**；模型懒加载/预热，未就绪时自动只用 BM25
- `js/ai.js`：`_retrieveSections` 改为 hybrid 优先、bigram 兜底；删除 edge-function 语义检索路径；`search_knowledge` 工具与开 sidebar 预热同步改造
- 生成仍用免费 `glm-4-flash`（nanofab 不受"禁商用 API"约束）
- 验证：`scripts/test-retrieval.mjs` 实测——"lithography 分辨率极限"(中英混)正确召回"分辨率记录/光学衍射极限/半节距与k1极限"，"为什么芯片越做越小越难"召回摩尔定律/光刻路线图，证明语义检索生效（旧 bigram 在中英混用上完全失效）
- 影响：pgvector/knowledge-search/嵌入 secret 检索侧已不再使用（待清理）；generate-quiz 仍依赖 pgvector 接地(空表→回退静态题)，每周爬取写入暂未接入客户端索引——均列入后续迁移


## 2026-06-14 - RAG 向量库 + AI Agent（四步）

把固定的"语义=bigram 字面检索 + 静态题"升级为"向量 RAG + 动态出题 + tool-use 对话 + 每周自动入库"。部署步骤见 `docs/RAG_AGENT_SETUP.md`。

**① 向量底座（RAG）**
- `supabase/migrations/20260614000000_knowledge_vectors.sql`：pgvector `knowledge_chunks` 表（教材小节 + 论文同库）、HNSW 余弦索引、RLS、`match_knowledge()` RPC
- `supabase/functions/_shared/embed.ts` + `scripts/lib/embed.mjs`：统一嵌入助手，模型可配置（默认智谱 embedding-3@1024），入库/查询一致
- `supabase/functions/knowledge-search/`：鉴权→嵌入查询→向量检索→带出处返回
- `scripts/ingest-textbook.mjs`：教材按小节(token 与前端一致)嵌入入库
- `js/ai.js`：`_retrieveSections` 改为语义检索优先、bigram 兜底（修复换说法/中英混用检索不到的问题）

**② 每周爬取前沿（GitHub Actions）**
- `.github/workflows/ingest-papers.yml`：每周一 cron
- `scripts/ingest-papers.mjs`：arXiv + OpenAlex（仅元数据+摘要，避开版权全文）→去重→LLM 中文摘要打标→嵌入入库
- `scripts/lib/llm.mjs` / `scripts/lib/store.mjs`：摘要与入库助手

**③ AI 动态出题**
- `supabase/functions/generate-quiz/`：基于该章入库原文(RAG 接地) + 画像/弱项/错题生成单选题，服务端校验结构
- `js/quiz.js`（新模块，混入 App）：按 用户+章节+画像版本 缓存、「换一批」、渲染进现有 quiz 结构、复用评分绑定
- `app.js`：`initLearningTools` 抽出 `bindQuizQuestions(scope)`（可重绑动态题）；章节加载后触发 `loadDynamicQuiz`

**④ 对话 tool-use（轻量 agent）**
- `supabase/functions/ai-proxy/`：新增 tools 透传与 `tool_calls` 返回（智谱/DeepSeek）；`_shared/chat.ts` 共享 chat 助手
- `js/ai.js`：工具 `search_knowledge` / `get_user_trajectory` / `save_note`，`_runToolLoop` 多轮工具回合，来源合并去重渲染引用
- Gemini 与异常自动回退原路径；`nanofab_ai_tools` / `nanofab_dynamic_quiz` 可关闭

**收尾**
- `js/ai.js` `_renderCitations`：论文来源(`arxiv:`/`openalex:` token)渲染为外部链接角标(📄)，参考来源区分"教材小节(可跳转)"与"前沿论文(外链)"；styles.css 加 `.ai-cite-paper`
- 设置面板新增「AI 动态出题」「AI 工具/Agent」开关(index.html + ai.js)，写入 `nanofab_dynamic_quiz` / `nanofab_ai_tools`

**部署状态（已通过 Supabase CLI 执行到生产 sbeklofkvwbkwdaokzcy）**
- ✅ migration `20260614000000` 已应用（pgvector 表 + RPC，本地/远端一致）
- ✅ Edge Functions 已部署：knowledge-search、generate-quiz、ai-proxy(更新)
- ✅ 复用既有 `ZHIPU_API_KEY` 项目密钥；嵌入默认 embedding-3@1024 与表维度一致
- ⏳ 待办：`npm run ingest:textbook` 灌教材(需 service_role + zhipu key)；GitHub Actions 配 Secrets 后启用每周爬取

**改用免费 Gemini 嵌入（智谱 embedding 需充值，改走零成本路径）**
- migration `20260614010000_embedding_dim_768.sql`：嵌入维度 1024→768，重建列/HNSW 索引/`match_knowledge`(已应用)
- secret 设为 `EMBEDDING_PROVIDER=gemini` `EMBEDDING_MODEL=text-embedding-004` `EMBEDDING_DIM=768`
- 新增服务端一次性灌入：`supabase/functions/ingest-admin/`(共享密钥保护)+ `scripts/post-ingest.mjs` + `scripts/lib/parse-textbook.mjs`(本地解析 236 节、服务端嵌入入库，本地免密钥)
- 灌入路径已验证打通；仅差 `GEMINI_API_KEY`(免费)未配，配后重跑即可灌满

## 2026-05-31 - 学习报告：一键预览 + 浏览器原生 Save as PDF

学生入口：用户资料弹窗 → 「导出学习报告」 → 预览 → 「下载/打印 PDF」（走浏览器原生打印对话框，可保存 PDF / 直接打印）。无需任何 PDF 库，Noto Serif/Sans SC 字体直接矢量打印。

报告内容：
- 头部：姓名、邮箱、当前水平、背景、动机、生成时间
- 概览：章节完成 / 累计时长 / 答题正确率 / 连续天数
- 章节进度：按 4 个 part 分组，已完成 ✓、未完成 ○，附该章学习时长
- AI 学习路径（若已生成）：目标、覆盖范围、各步骤为何需要 / 重点掌握
- 学习笔记：按章节分组，含原文上下文、笔记内容、日期，AI 笔记带 🤖 标记
- 答题记录：总览（正确/错误数）+ 错题列表（题目、你的答案、正确答案）
- 学习画像：擅长 / 需加强主题、兴趣领域、在研项目
- 页脚：声明仅基于平台聚合行为、不含原始事件

实现要点：
- `js/behavior.js` 新增 `openReportModal` / `closeReportModal` / `printReport` / `_buildReportHTML`，复用已有的 chapters/behaviorData/notes/goalPath 状态
- `index.html`：profile 弹窗加 「导出学习报告」按钮；新增 `#report-modal` 预览
- `app.js` `bindEvents`：绑定导出按钮、打印按钮、modal 关闭与遮罩
- `styles.css`：屏幕侧 paper-like 学术风排版（Noto Serif SC 标题 + 主题蓝细节）；`@media print` 用 `body.printing-report` 类隐藏其他一切，A4 18/16mm 边距，分页避让规则避免标题孤行

## 2026-05-31 - 简历/成绩上传增强：支持照片/扫描件 OCR

补齐 2026-05-26 老师反馈 ① 的最后一块：图片格式的成绩单/简历可直接上传识别。

- `index.html`：上传 input 的 `accept` 增加 `image/jpeg,png,webp`；提示文字说明可传"成绩单照片、扫描件"
- `js/auth.js` 新增 `_imageToCompressedDataURL`：图片在浏览器端先缩到 ≤1600px 长边再 JPEG 0.85 编码，避免请求体过大
- `js/auth.js` 新增 `_extractImageText`：用智谱 **GLM-4V-Flash**（免费视觉模型）转写图片上的所有文字，`temperature=0` 保持数字精确
- `handleProfileUpload` 按文件扩展名 / MIME 类型路由：PDF→pdf.js / 图片→视觉 OCR / 其他→`file.text()`；识别结果与其它来源合并后交现有 `_distillProfile` 结构化填表
- `js/behavior.js` `_logAIQuery` 兼容多模态 content 数组（数组场景把 image_url 折叠为 `[图片]` 标记后再入库），不再因 array.content 写入异常
- **无需重新部署 ai-proxy**：现有 zhipu 分支已 pass-through messages，多模态格式天然透传

## 2026-05-27 - 修复严重隐私 bug：新用户能看到其他用户的笔记与 AI 会话

**根因**：
1. 用户 profile 对象没有 `id` 字段，`_chatUid()` 用 `state.user?.id` 永远取不到 → 所有用户的聊天会话都落到同一个 `anon` 桶
2. `behaviorData`（含笔记/高亮/答题）用全局 key `nanofab_behavior` 存储，不分用户
3. 登录/登出时未重置内存数据，且 `loadUserFromSupabase` 仅在有 behaviorSummary 时才重置 behaviorData，新用户会沿用上一个用户的本地数据

**修复**：
- 引入认证用户 id 作为隔离键 `state.authUserId`（来自 Supabase 会话，持久化到 `nanofab_auth_uid`）
- `behaviorData`、`progress`、聊天会话、目标路径全部改为按 `uid` 分桶存储
- `loadUser` 改为以 Supabase 会话为准，不再信任可能过期的本地资料；无会话即进入登录引导
- 载入/切换用户前先 `_resetUserScopedState()` 清空内存数据，杜绝跨用户残留
- 启动时一次性清除旧版泄漏的全局/匿名 key（`nanofab_behavior`、`nanofab_progress`、`*_anon` 等）
- 登出时清除当前用户分桶数据与认证绑定

## 2026-05-27 - ⑤ 学习路径个性化增强：扣住目标 + 结合画像/轨迹

针对"为何需要"过于泛泛、未结合目标与用户数据的问题：

- 目录线索增强：每个小节附上要点/正文首句，让 AI 有依据判断它与目标的关系
- 新增 `_buildGoalUserContext`：把用户画像（水平/先修/兴趣/背景/在研项目）+ 学习轨迹（已学章节/薄弱环节/正确率）一并喂给规划
- 重写 prompt，强制 `why` 必须说明"这一节在实现该具体目标时起什么作用"，并给出正/反例约束；要求结合已学章节、薄弱项、在研项目做个性化
- `focus` 改为"针对该目标"的重点；steps 描述更具体

## 2026-05-27 - 外部参考来源：联网搜索补充教材之外的论文/网页

在 ④ 教材引用之外，回答再附上**真实的外部参考**：

- ai-proxy（Edge Function）为智谱 GLM 开启 `web_search` 工具，返回真实的网页/论文标题与链接（已用 supabase CLI 重新部署）
- `callAIProvider` 新增 `webSearch` 开关，聊天时透传并回收搜索结果
- AI 回答末尾在「参考来源 · 基于本平台教材」之外，新增「**外部参考 · 联网搜索（请自行核实）**」区块，列出可点击跳转的外部链接（新标签页打开，显示标题 + 域名）
- 外部链接来自真实搜索而非模型臆造，避免编造文献/URL

## 2026-05-27 - ① 简历/成绩上传 + AI 自动提取

依据 2026-05-26 老师反馈第 1 点（简历和成绩可直接上传文件，AI 提取内容存储）：

- 注册画像表单新增「上传简历 / 成绩单 / 附件」区域，支持多文件
- PDF 用 pdf.js 客户端解析提取文字；txt/md/csv/json 直接读取
- 提取的文字交给 AI 结构化为 JSON（个人简介摘要 / 相关课程成绩 / 当前项目），自动填入下方对应字段，用户可再手动修改
- 逐文件显示解析状态；提取仅在前端 + 现有 ai-proxy 完成，无需新增后端

## 2026-05-27 - ⑤ 目标导向学习路径（动态知识书雏形）

依据 2026-05-26 老师反馈第 5 点（目标导向、个性化、动态知识书）：

- 首页新增「**目标导向学习路径**」卡片：用户输入一个目标（如"我想做 X 射线光栅"）
- AI 拿到整本教材的「章—小节」紧凑目录（复用 ④ 的内容索引，每节带来源标记），筛选出实现目标所需的**最小知识子集**并排出学习顺序
- 返回结构化路径：每步含 `所属小节 / 为何需要 / 重点掌握`，渲染成带序号连线的学习清单
- 每步「去学习 →」按钮跳转到本站对应小节（复用 ④ 的 jumpToSection）
- 路径与目标持久化到 localStorage（按用户隔离），刷新后恢复；目标顺带写入用户画像（⑥）
- 仅依据教材已有小节规划，指令 AI 不得虚构小节

## 2026-05-27 - ④ 引用透明：让 AI 回答出自本书并标注来源

依据 2026-05-26 老师反馈第 4 点（知识来源不明）与第 3.4 点（喂给 AI 的是什么）：

**背景**：此前 AI 只拿到「章节标题 + 一句描述」，答案实际出自模型自身记忆而非本书 —— 这正是"来源不明"的根因。

**内容索引（地基，④⑤ 共用）**
- 页面加载后后台解析 12 章 HTML，建成「章 → 小节（h2/h3）→ 正文 + 要点」索引并缓存（纯客户端，无需向量库）

**检索 + grounding**
- 提问/选中时按 2-gram 关键词从索引命中相关小节，把**小节原文**注入 AI 上下文
- 指令 AI **优先依据教材原文回答**，并在相关句末用 `[[来源标记]]` 引用；资料不足时须声明"教材未直接涵盖"，不得编造来源

**来源展示**
- 行内 `[[标记]]` 渲染为可点的 `§第X章` 角标；回答末尾附「参考来源 · 基于本平台教材」小节列表
- 点击角标/来源 → 跳转到本站对应章节小节（复用 scroll-margin 定位）
- **版权规避**：只引用/跳转到平台自有的已转写内容，绝不暴露原始 PDF

## 2026-05-27 - 去掉时间规划字段 + "课程"措辞改为"平台/工具"

依据 2026-05-26 老师反馈第 1 点（不做时间上的学习规划；这是平台/工具而非课程）：

- 注册画像移除「**计划学习时间**（studyPace）」与「**每周预计学习时间**（weeklyHours）」两个字段
- 仪表盘移除「**本周目标进度**」进度条（基于周学习时长目标的时间规划）
- 同步清理读取上述字段的 system prompt、学习路径建议、行为统计等代码
- 措辞调整：「课程目录/课程结构」→「知识目录/知识结构」，"学完本课程"→"通过本平台学习"，欢迎页特色描述同步更新

## 2026-05-27 - 选中文本：支持自定义提问

依据 2026-05-26 老师反馈第 2 点（选中 → 提问）：

- 选中正文后的浮层从单一「AI解释」按钮，改为**「解释这段」按钮 + 提问输入框**
- 可对选中内容直接输入具体问题（回车或点发送），不再只能笼统解释
- 选中的**原文直接嵌入可见的用户消息**中，用户能清楚看到「喂给 AI 的到底是什么」（回应老师第 3.4 点的疑问）
- 同步更新输入框 placeholder 与首页/会话引导文案

## 2026-05-27 - 反馈快赢：AI 回答克制 + 滚动定位修复

依据 2026-05-26 老师反馈：

### AI 回答风格收敛
- 改写 system prompt：AI 只给问题的**直接答案**，去掉寒暄、铺垫与客套
- 禁止夸奖用户、评价问题（"好问题""很有意思"）、告知学习进度等无效信息
- 个性化改为**后台静默生效**：用画像决定解释深度与例子，但不再向用户复述"结合了你的数据/笔记/进度"
- 不再在每条问答末尾附加"下一步学习建议"；仅当用户明确询问时才给指导
- 同步收敛 chat / explanation 上下文指令与数据注入消息的措辞

### 滚动定位修复
- 给章节标题与小节标题加 `scroll-margin-top`，点目录/小节跳转后**标题行不再被吸顶导航遮住**

## 2026-05-25 - AI 助手统一对话与个性化记忆

### 统一对话
- 将「AI解释」与「助手」两个标签**合并为一个会话式对话**
- 选中正文点「AI解释」→ 自动在当前会话注入一条消息，AI 回复就在同一对话流中，可继续追问
- 聊天现在会携带**当前会话的多轮上下文**发送给 AI，真正支持连续对话

### 会话管理
- 新增**历史会话**抽屉：可切换会话、新建对话（「+ 新对话」）、删除会话
- 会话持久化到 localStorage，**按用户隔离**；标题自动取首条消息

### 渲染与展示
- AI 回答改用 `marked` 做完整 **Markdown 渲染**（表格、代码块、引用、嵌套列表、链接），并用 KaTeX 渲染 LaTeX 公式
- AI 侧边栏加宽 380 → 480px（小屏限 92vw）
- 每条 AI 回答下方提供「**存为笔记**」按钮，保存后在正文高亮原文并插入批注

### 个性化记忆
- 从数据库 `ai_queries` 表读取用户**跨会话的历史问答**（带缓存）回喂给 AI，使回答更贴合用户长期关注点与反复出现的盲区
- 「保存对话为笔记」支持**勾选要保存的问答**，不再只能全部保存

## 2026-05-22 - 欢迎页导航与宽度优化

### 欢迎页
- 新增**顶部 sticky 锚点导航**（核心功能 / 为什么选 AI / 功能详情 / 开始使用），平滑滚动 + 当前区高亮
- 拓宽页面布局以填满浏览器宽度（容器上限 1680px + 响应式留边），正文与统计条保持居中限宽以保证可读性
- 修正主标题文案为「更是一位懂你的 AI 导师」
- 将返回链接「欢迎页」改名为「首页」

## 2026-05-13 - 欢迎页重构与界面现代化

### 欢迎页
- 全新欢迎页（**晶体精密美学**）：六边形晶格背景、浮动晶体形状、玻璃态卡片、放大排版增强视觉冲击
- 功能卡片从弹窗模式改为**滚动揭示 + 点击跳转**
- 首页统计数字（12/4/6）补充解释副标题，含义更清晰
- 认证页与应用 header 增加**"返回欢迎页"**入口
- 修复欢迎页无法滚动的问题

### 界面现代化
- 思维导图 SVG 重设计（贝塞尔曲线分支、渐变卡片、编号徽章、章节计数）
- Dashboard 卡片渐变强调色、彩色导航、学习统计着色与悬停效果
- 玻璃态 header、按钮阴影与按压态、表单 focus ring 等整体打磨

## 2026-05-13 - AI 深度整合与系统重构

### AI 解释增强
- 文本选中解释增加**问题输入框**，用户可附带问题一起提交给 AI
- 支持**多轮追问**：同一段选中文本可连续提问，保持对话上下文
- 多轮问答保存为**单条笔记**（合并所有 Q&A 对），不再拆分为多条碎片笔记

### AI 笔记系统
- AI 解释结果增加"保存为笔记"按钮
- 保存的 AI 笔记自动在原文**高亮标注**，点击可查看注解
- AI 笔记渲染 Markdown 格式（粗体、列表、标题等）

### AI 学习助手
- AI 助手现在**每次对话自动注入**用户完整数据上下文，不再仅限关键词触发
- 注入数据包括：笔记、答题记录、学习进度、学习时长、行为画像、最近操作
- AI 可根据用户薄弱环节和擅长领域提供个性化建议

### 认证系统完善
- 完整的登录、注册、邮箱验证、忘记/重置密码流程
- 注册防重复提交、按钮加载态修复
- 注册流程 try/finally 保证状态锁正确释放
- 新增触发器自动创建 `user_profiles` 和 `user_progress` 行

### 代码重构
- `app.js` 拆分模块化：
  - `js/auth.js` — 认证模块（841 行）
  - `js/behavior.js` — 行为追踪模块
  - `js/ai.js` — AI 模块
- 思维导图重设计

### Bug 修复
- 修复 Markdown 转 HTML 后行内 LaTeX 公式渲染异常（`_` 被误转为 `<em>`）
- 替换 Safari 不兼容的正则 lookbehind 为兼容写法
- 修复思维导图章节 ID 与标题重叠
- 修复 `behaviorProfile` 从 `user_behavior_summary` 回填

### 数据库优化
- Schema v2 优化
- 新增 `user_behavior_summary` 聚合回填

### 文档
- README 重写为完整项目文档

## 2026-05-12 (PM) - UI enhancements & learning tools (teacher feedback)

### Layout & Design
- Expanded desktop layout: main content area 900px→1100px, onboarding form 560px→780px
- Unified font families across chapter content and UI components
- Wider radio/checkbox option buttons for better readability

### New Features
- Added mind map visualization on homepage showing course structure
- Added study statistics dashboard (today/week/total study time with weekly goal)
- Added image lightbox: click any image in chapter content to zoom
- Added sidebar sub-headings: h2/h3 from chapter content shown in navigation
- Added per-chapter learning objectives (basic + advanced levels)
- Added wrong answer book collecting incorrect quiz answers
- Added text highlighting and note-taking functionality
- Added "我的笔记" button in profile modal to view saved notes
- Chapters now show TL;DR summary box at top

### User Profile
- Added "毫无基础" option to knowledge level and prerequisites
- Added "每周预计学习时间" (weekly study hours) field to profile form
- Added purpose description explaining why information is collected

### AI Personalization
- Enhanced `buildSystemPrompt` with weekly study time and behavior data
- AI now tailors explanations for "毫无基础" users with simplest analogies
- System prompt now suggests study advice based on behavior patterns

## 2026-05-12 (AM) - Security hardening & bug fixes

### Security
- Moved Zhipu API key from client-side JS to Supabase Edge Function (`supabase/functions/ai-proxy/`)
- Tightened RLS policies: removed anonymous INSERT, now requires authentication for all tables
- Added unique constraint on `quiz_answers(user_id, chapter_id, question_id)` to prevent duplicates

### Bug Fixes
- Fixed AI chat messages losing Markdown formatting (assistant responses now render bold, lists, etc.)
- Fixed behavior data being discarded when loading user from Supabase
- Fixed `formatAIResponse` not converting Markdown list syntax (`- item`) to HTML `<li>`
- Fixed Mermaid diagram ID collision risk when multiple diagrams render in same millisecond
- Fixed inconsistent indentation in `handleLogin`, `handleRegister`, `handleVerify`

### Improvements
- Extracted unified `callAIProvider` method, eliminating ~150 lines of duplicated AI API call logic
- Throttled `saveBehaviorData` writes to localStorage/Supabase at 5-second intervals
  - Exceptions: navigation (hashchange) and quiz submissions save immediately

## 2026-05-04 - AI personalization & learning tools completed

- Implemented AI text selection feature with floating tooltip
- Created AI explanation modal with personalized content based on user level
- Added behavior tracking system (scroll depth, time spent, interactions, quiz results)
- Implemented learning tools section with tabbed interface
- Created key points cards with visual icons for chapter summaries
- Built interactive quiz system with 3 question types and instant feedback
- Added thinking exercises with expandable hints
- Integrated all learning tools into chapter content flow
- Added quiz completion summary with score display
- LocalStorage persistence for behavior data

## 2026-05-04 - Website foundation completed

- Created complete HTML/CSS/JS single-page application
- Implemented user onboarding with profile collection (name, background, motivation, level)
- Built responsive navigation sidebar with collapsible parts (4 parts, 12 chapters)
- Added progress tracking with circular ring indicator and dashboard progress bar
- Implemented chapter completion marking with visual indicators
- Converted all 12 chapters from Markdown to HTML format
- Added KaTeX support for mathematical formula rendering
- Created user profile modal with reset functionality
- Mobile-responsive design with hamburger menu and overlay
- LocalStorage persistence for user profile and chapter progress

## 2026-05-04 - Project initialized

- Scaffolded context engineering files (AGENTS.md, docs/TODO.md, docs/CHANGELOG.md, docs/ARCHITECTURE.md)
- Defined project scope: AI-driven personalized nanofabrication learning platform
- Based on NanoFab Knowledge Book v1 (4 parts, 12 chapters)
