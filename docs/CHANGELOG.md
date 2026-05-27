# Changelog

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
