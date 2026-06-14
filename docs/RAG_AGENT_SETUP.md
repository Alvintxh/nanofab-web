# RAG 向量库 + AI Agent 部署指南

> ⚠️ **已过时（2026-06-14）**：检索已改为**纯客户端 hybrid（BM25 + 本地 bge，Transformers.js）**，
> pgvector / knowledge-search / 嵌入 secret 已全部拆除。本文中的 pgvector/Edge 嵌入部分不再适用。
> 现行做法见 `CHANGELOG.md`：`npm run build:embeddings` 生成 `content/knowledge_index.json` 随站点发布即可；
> 论文由 `.github/workflows/ingest-papers.yml` 每周本地嵌入写 `content/papers_index.json`。
> 现存云端仅 `ai-proxy`(chat) + `generate-quiz`(出题)。

---


四步能力：①向量知识库(RAG) ②每周爬取前沿论文 ③AI 动态出题 ④对话 tool-use。
代码已就位，但以下部署步骤需你在 Supabase / GitHub 手动执行（本地无法替你完成）。

---

## 0. 关键约束（务必先读）

**嵌入模型必须全库统一、与查询一致。** 入库(教材/论文)和检索查询都用同一个 embedding 模型与维度，否则余弦相似度失真。
默认 **智谱 embedding-3 @ 1024 维**。若改用 Gemini text-embedding-004(768 维)，需同步：
- 修改 `supabase/migrations/20260614000000_knowledge_vectors.sql` 里 `vector(1024)` → `vector(768)`
- 设置环境变量 `EMBEDDING_PROVIDER=gemini` `EMBEDDING_MODEL=text-embedding-004` `EMBEDDING_DIM=768`
- 重新灌库（嵌入空间变了，旧向量作废）

> DeepSeek 无 embedding API，不能用于嵌入（仍可用于聊天/出题）。

---

## 1. 数据库（pgvector 向量底座）

在 Supabase SQL Editor 执行迁移：
```
supabase/migrations/20260614000000_knowledge_vectors.sql
```
它会：启用 `vector` 扩展、建 `knowledge_chunks` 表、HNSW 余弦索引、RLS（登录可读、仅 service_role 可写）、`match_knowledge()` 检索 RPC。

## 2. Edge Functions（部署 3 个）

```bash
supabase functions deploy knowledge-search   # 语义检索
supabase functions deploy generate-quiz       # 动态出题
supabase functions deploy ai-proxy            # 已有，需重新部署(新增 tool-use 支持)
```

Edge Function 环境变量（Supabase → Project Settings → Edge Functions → Secrets）：
```
ZHIPU_API_KEY        = <智谱key>        # 已有
EMBEDDING_PROVIDER   = zhipu            # 可选，默认 zhipu
EMBEDDING_MODEL      = embedding-3      # 可选
EMBEDDING_DIM        = 1024             # 须与表维度一致
# 如用 deepseek/gemini 聊天/出题，另配 DEEPSEEK_API_KEY / GEMINI_API_KEY
```
（`SUPABASE_URL` / `SUPABASE_ANON_KEY` 为平台内置，无需手动设。）

## 3. 灌入教材（一次性）

本地设置环境变量后运行：
```bash
npm install
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # 注意保密，勿提交
export ZHIPU_API_KEY=<智谱key>
npm run ingest:textbook
```
脚本会把 `content/chapters/*.html` 按小节切分(token 与前端一致，出处可跳转)、嵌入、写入 `knowledge_chunks`。

## 4. 每周爬取（GitHub Actions）

工作流：`.github/workflows/ingest-papers.yml`（每周一 01:00 UTC，亦可手动 workflow_dispatch）。
在 GitHub 仓库 Settings 配置：
- **Secrets**：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ZHIPU_API_KEY`
- **Variables（可选）**：`EMBEDDING_PROVIDER/MODEL/DIM`、`LLM_PROVIDER`、`OPENALEX_MAILTO`(填你的邮箱，OpenAlex 礼貌池更快)

数据源：arXiv API + OpenAlex API，**仅抓公开元数据与摘要，不抓版权全文**。按 `token`(arXiv/OpenAlex id) 去重，LLM 生成中文摘要+标签后嵌入入库。
调参环境变量：`INGEST_DAYS`(默认8天窗口)、`INGEST_MAX`(每源条数)、`INGEST_TERMS`(检索词，逗号分隔)。

先手动跑一次（workflow_dispatch 或本地 `npm run ingest:papers`）验证。

---

## 前端开关（localStorage）

| key | 默认 | 说明 |
|---|---|---|
| `nanofab_dynamic_quiz` | 开 | `'0'` 关闭 AI 动态出题，回退静态题 |
| `nanofab_ai_tools` | 开 | `'0'` 关闭对话 tool-use，回退原检索注入路径 |

两者都做了**优雅降级**：Edge Function 未部署 / 报错时，对话回退原路径、出题保留静态题，不会白屏。

---

## 行为说明 / 已知边界

- **动态出题缓存**：按 `用户+章节+画像版本` 缓存，水平/弱项/该章错题数变化才重生成；「换一批」按钮强制重出。不是字面"每次打开都重算"，是为了控制成本与延迟。
- **出题接地与校验**：题目只依据该章入库原文生成，服务端校验"4 选项 + 正确项合法"，不合格题剔除。AI 选择题仍可能偶有瑕疵，建议抽查。
- **tool-use 仅限智谱/DeepSeek**（OpenAI 兼容 function calling）；Gemini 自动走原注入路径。
- **论文引用渲染**：论文 token(如 `arxiv:xxx`)不匹配教材角标正则，目前在「参考来源」列表体现、暂不渲染为正文角标。后续可扩展 `_renderCitations` 支持论文链接角标。
