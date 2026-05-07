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

## Up Next

- [ ] 测试注册流程端到端
- [ ] 验证数据库表是否正确创建
- [ ] 确认RLS策略已生效
- [ ] 检查邮件验证设置

## Completed

- [x] 项目初始化（2026-05-04）
- [x] 网站基础框架（2026-05-04）
- [x] AI个性化和学习工具（2026-05-04）
- [x] 修复登录/注册bug（2026-05-05）
  - [x] 修复profile modal无响应问题
  - [x] 修复resetProfile未清除Supabase session
  - [x] 修复saveUser未使用pending_user_id
  - [x] 修复handleProfileSubmit未添加email
  - [x] 修复loadUser JSON解析错误
  - [x] 修复saveBehaviorData表名错误
- [x] 实现AI侧边栏（2026-05-05）
  - [x] 右侧固定面板
  - [x] 标签切换（AI解释/助手）
  - [x] 浮动切换按钮
- [x] 数据库配置（2026-05-05）
  - [x] 创建完整Schema
  - [x] 修复RLS策略允许匿名插入
  - [x] 添加部署文档

## 已知问题

1. **邮件验证**：Supabase Dashboard中可能找不到"Confirm email"开关，需要确认最新位置
2. **数据库同步**：即使RLS修复后，如果邮件验证开启，注册后仍无session，导致无法同步数据
3. **解决方案**：关闭邮件验证（测试环境）或实现Edge Function自动确认邮箱

## 下一步行动

1. 在Supabase Dashboard执行 `supabase/fix_rls.sql`
2. 关闭邮件验证（Authentication → Providers → Email → Confirm email）
3. 测试新用户注册
4. 检查浏览器控制台日志
5. 在Table Editor中验证数据是否写入
