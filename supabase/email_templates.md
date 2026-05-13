# Supabase 邮件模板配置

## 问题
默认的 Supabase "Confirm Signup" 邮件模板只包含 `{{ .ConfirmationURL }}`（确认链接），不包含 `{{ .Token }}`（6 位验证码）。导致用户收到的注册邮件中没有验证码。

## 解决方案

### 在 Supabase Dashboard 中修改邮件模板

1. 进入 [Supabase Dashboard](https://supabase.com/dashboard) → 选择项目
2. 左侧导航 → **Authentication** → **Email Templates**
3. 点击 **Confirm Signup** 标签
4. 在邮件 HTML 内容中，**添加** 以下内容（位置自定义）：

```html
<p>您的6位验证码：<strong style="font-size: 24px; letter-spacing: 4px;">{{ .Token }}</strong></p>
<p>或者点击下方链接完成验证：<a href="{{ .ConfirmationURL }}">确认注册</a></p>
```

修改后用户会同时收到：
- **6位验证码** — 可输入到验证表单
- **确认链接** — 点击链接自动跳转验证（应用代码已支持此流程）

### 其他邮件模板建议

**Reset Password:**
```html
<p>点击下方链接重置密码：<a href="{{ .ConfirmationURL }}">重置密码</a></p>
```
