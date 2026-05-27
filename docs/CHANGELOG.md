# Changelog

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
