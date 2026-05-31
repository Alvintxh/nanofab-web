# TODO

## Current Task

- [x] 初始化项目上下文工程文件
- [x] 定义用户画像示例（学习动机+知识背景）
- [x] 设计网站架构与页面结构
- [x] 搭建基础HTML框架（章节导航+内容展示）
- [x] 实现用户注册/登录系统
- [x] 实现AI个性化内容生成模块
- [x] 实现学习行为数据收集系统
- [x] 添加要点卡片、Quiz、思考练习组件
- [x] 实现AI侧边栏面板（替代弹窗形式）
- [x] 创建数据库Schema和RLS策略
- [x] 修复注册流程中的数据库同步问题
- [x] 添加详细的错误处理和日志记录
- [x] 编写部署配置文档

## Teacher Feedback (2026-05-12)

- [x] 电脑端布局优化，利用宽屏空间
- [x] 用户画像增加"毫无基础"选项
- [x] 注册引导说明信息收集目的
- [x] 添加每周预计学习时间设置
- [x] 学习统计展示（今日/本周/累计 + 周目标进度）
- [x] AI个性化增强：行为轨迹反馈给AI
- [x] 课程文字精简（章首 TL;DR 速览）
- [x] 侧边栏显示二级标题（h2/h3）
- [x] 首页课程结构思维导图
- [x] 字体统一
- [x] 图片点击放大（Lightbox）
- [x] 每章添加学习目标（基础/进阶）
- [x] 错题本功能
- [x] Highlight 标记重点 + 记笔记功能

## Teacher Feedback (2026-05-26)

- [x] ③ AI 回答克制：只给直接答案，去掉客套/进度/每条建议，个性化后台静默生效
- [x] ⑦ 滚动定位：点目录跳转标题不被吸顶导航遮住
- [x] ② 选中文本支持自定义提问（不止"AI解释"），并显式呈现喂给 AI 的原文
- [x] ① 去掉时间规划字段（studyPace/weeklyHours）+ "课程"措辞改"平台/工具"
- [x] ④ 引用透明：内容索引 + 检索教材原文 grounding + 可点来源角标/参考小节
- [x] ⑤ 目标驱动动态知识书：输入目标 → AI 规划最小知识子集 + 学习路径
- [x] ① 简历/成绩支持上传文件（PDF/文本），AI 提取并自动填表
- [x] ⑥ 引入更强的用户画像（目标已入画像；简历/成绩经 AI 结构化提取）
- [x] 图片/扫描件成绩单 OCR：智谱 GLM-4V-Flash（2026-05-31，复用现有 ai-proxy 多模态透传，无需后端改动）

## Up Next

- [x] 部署 Supabase Edge Function（ai-proxy v6 ACTIVE, 2026-05-27）
- [x] 设置 ZHIPU_API_KEY（已配）
- [x] 应用最新 RLS（`schema_v2.sql` + `migrations/20260525_user_notes_delete_policy`，`fix_rls.sql` 已废弃）
- [ ] **仅需用户手动确认**：邮件验证设置（Supabase Dashboard → Authentication → Sign In/Up → Confirm email）
- [ ] **仅需用户手动确认**：邮件模板 / 站点 URL（用于密码重置回跳）

## Completed

- [x] 项目初始化（2026-05-04）
- [x] 网站基础框架（2026-05-04）
- [x] AI个性化和学习工具（2026-05-04）
- [x] 修复登录/注册bug（2026-05-05）
- [x] 实现AI侧边栏（2026-05-05）
- [x] 数据库配置（2026-05-05）
- [x] 安全加固与Bug修复（2026-05-12）
  - [x] API Key迁移到Supabase Edge Function
  - [x] 收紧RLS策略（anon → authenticated）
  - [x] 修复AI聊天Markdown渲染丢失
  - [x] 修复loadUserFromSupabase行为数据被丢弃
  - [x] 修复formatAIResponse不解析Markdown列表
  - [x] 提取统一callAIProvider去重（-146行）
  - [x] saveBehaviorData节流优化（5秒批量写入）
  - [x] Mermaid ID碰撞修复
  - [x] 代码缩进修正
  - [x] quiz_answers添加唯一约束

## 已知问题

1. **邮件验证**：若 Supabase 开启 Confirm email，注册后无即时 session，需走 OTP/链接验证流程（前端已支持 verify-form + recovery flow）
2. **DeepSeek / Gemini secrets 未配**：当前仅 ZHIPU_API_KEY 在服务端，用户切到 DeepSeek/Gemini 必须自带 key（前端已提示）
