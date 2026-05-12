# Project: NanoFab Learning Platform

> 基于《纳米制造技术：原理、工艺与实践》的AI驱动个性化学习网站

## Architecture

- **Frontend**: 纯HTML/CSS/JS（单页应用，无需构建工具）
- **Content**: 从Markdown知识书动态加载
- **AI Personalization**: 客户端AI接口（OpenAI/Claude API）
- **User Profiles**: LocalStorage + 可选后端
- **Behavior Tracking**: 客户端事件捕获

## Conventions

- 所有内容文件使用UTF-8编码
- 中文界面，英文技术术语保留原文
- 遵循上海科技大学视觉风格（蓝 #004EA1，红 #9D0A12）
- 响应式设计，支持桌面和移动端

## Key Files

- `index.html` - 主入口，包含用户画像收集
- `app.js` - 核心应用逻辑（路由、状态管理、AI接口）
- `styles.css` - 全局样式
- `content/` - 从知识书提取的章节内容（JSON/Markdown）
- `components/` - 可复用UI组件（Quiz、要点卡片等）

## Rules

- Update docs/TODO.md after completing each major step
- Update docs/CHANGELOG.md when features are added, bugs fixed, or breaking changes made
- Keep this file focused on stable conventions, not transient state
- 所有用户可见文本使用中文
- AI生成的解释内容需根据用户背景定制

## Context Continuity

- `docs/TODO.md` -- Current work state (checkboxes). Read this first when resuming.
- `docs/CHANGELOG.md` -- What was done and why. Read for historical context.
- `docs/ARCHITECTURE.md` -- System design decisions.
