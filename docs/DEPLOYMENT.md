# NanoFab Learning Platform - 部署与配置指南

## 数据库配置

### 1. 创建表结构

在 Supabase Dashboard 的 SQL Editor 中执行 `supabase/schema.sql`：

1. 打开 Supabase Dashboard
2. 点击左侧菜单 "SQL Editor"
3. 点击 "New query"
4. 将 `supabase/schema.sql` 的内容粘贴进去
5. 点击 "Run"

这会创建以下表：
- `user_profiles` - 用户画像
- `user_progress` - 学习进度
- `user_behavior_events` - 行为事件
- `user_behavior_summary` - 行为汇总
- `quiz_answers` - Quiz 答案
- `ai_queries` - AI 查询记录

### 2. 修复 RLS 策略

执行 `supabase/fix_rls.sql`：

1. 在 SQL Editor 中新建查询
2. 将 `supabase/fix_rls.sql` 的内容粘贴进去
3. 点击 "Run"

这会允许匿名用户在注册时插入数据。

### 3. 关闭邮件验证（可选，用于测试）

**路径**: Authentication → Providers → Email

1. 在 Supabase Dashboard 左侧菜单点击 "Authentication"
2. 点击 "Providers" 标签
3. 找到 "Email" 提供商，点击展开
4. 找到 "Confirm email" 开关，关闭它
5. 点击 "Save"

这样注册后用户会立即获得 session，无需验证邮件。

## 前端配置

### Supabase 连接信息

在 `index.html` 中确认以下配置：

```javascript
const SUPABASE_URL = 'https://sbeklofkvwbkwdaokzcy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZWtsb2Zrdndia3dkYW9remN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzcxMjQsImV4cCI6MjA5MzU1MzEyNH0.w0Lr3IjE4Von74pUmTXbwV5Ad1P3cZgWQ2eKyW08D98';
```

## 测试注册流程

1. 打开网站
2. 点击 "注册"
3. 填写邮箱、密码、姓名
4. 提交
5. 完善个人资料
6. 检查浏览器控制台是否有错误
7. 在 Supabase Dashboard 的 Table Editor 中查看 `user_profiles` 表

## 常见问题

### 问题：注册成功但数据库没有数据

**可能原因**：
1. RLS 策略未正确执行
2. 邮件验证已开启，导致没有 session
3. 表结构未创建

**解决方法**：
1. 确认 `fix_rls.sql` 已执行
2. 关闭邮件验证（测试环境）
3. 检查浏览器控制台错误信息

### 问题：邮件发送频率限制

**错误**: `over_email_send_rate_limit`

**解决方法**：
- 等待 1 分钟后重试
- 或关闭邮件验证（测试环境）

### 问题：找不到 "Confirm email" 开关

**最新路径**：
- Authentication → Providers → Email → Confirm email toggle

如果找不到，可能是界面更新，请查看 Supabase 文档。
