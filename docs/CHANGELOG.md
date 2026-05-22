# Changelog

## 2026-05-22 - AI 章节漫画（个性化科普漫画）

### 章节漫画生成
- 新增**"生成本章漫画"**功能：将章节内容改编为 12 格科普漫画
- 流程：章节正文 → LLM 生成分镜脚本 → CogView 文生图 → HTML 合成整页漫画书
- **哆啦A梦风原创吉祥物**（蓝白机器人猫向导 + 好奇学生男孩），神似但原创以规避版权
- 整页排版：标题横幅、漫画分格粗边框、带尾巴的对白气泡；中文对白用 HTML 叠加，保证文字清晰

### 个性化讲解
- 漫画讲解深浅按**用户画像**定制（学习水平、动机、先修知识、兴趣领域）
- 结合**行为数据**：命中用户薄弱环节的知识点讲解得更细致、放慢节奏
- 漫画缓存按用户 ID 隔离，避免同浏览器换账号串内容

### 文生图接入与稳健性
- Edge Function 新增 `task:"image"` 分支调用智谱 CogView
- **出图模型降级链** cogview-4（付费）→ cogview-3-flash（免费），账号充值后自动用回更优模型
- **脚本模型降级链** glm-4-plus → glm-4-air → glm-4-flash
- 出图失败自动重试一次、连续失败提前中止以节省额度、真实错误码透传便于排查

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
