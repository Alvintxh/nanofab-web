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

## Up Next

- [ ] 部署 Supabase Edge Function (`supabase functions deploy ai-proxy`)
- [ ] 设置 Edge Function 环境变量 (`supabase secrets set ZHIPU_API_KEY=...`)
- [ ] 在 Supabase Dashboard 执行更新后的 `supabase/fix_rls.sql`
- [ ] 测试AI解释和助手功能（通过 Edge Function）
- [ ] 测试注册流程端到端
- [ ] 验证数据库表是否正确创建
- [ ] 确认RLS策略已生效
- [ ] 检查邮件验证设置

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

1. **邮件验证**：Supabase Dashboard中可能找不到"Confirm email"开关，需要确认最新位置
2. **数据库同步**：RLS收紧后，如果邮件验证开启，注册后仍无session，用户数据无法同步
3. **解决方案**：关闭邮件验证（测试环境）或实现Edge Function自动确认邮箱

## 下一步行动

1. 部署Edge Function：`cd supabase && supabase functions deploy ai-proxy`
2. 设置密钥：`supabase secrets set ZHIPU_API_KEY=your-key`
3. 在Supabase Dashboard SQL Editor执行 `supabase/fix_rls.sql`
4. 测试新用户注册（确认RLS收紧后注册流程仍正常）
5. 测试AI聊天/解释（确认通过Edge Function正常响应）
