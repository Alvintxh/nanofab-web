-- ============================================
-- 向量知识库 (RAG 底座)
-- 教材小节 + 每周爬取的前沿论文，统一嵌入到同一张向量表
-- ============================================
--
-- ⚠️ 嵌入维度必须与所用 embedding 模型一致，且入库/查询必须用同一模型：
--   - 智谱 embedding-3 @ dimensions=1024  (默认)
--   - 若改用其它模型，请同步修改下方 vector(1024) 的维度并重新灌库
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id           BIGSERIAL PRIMARY KEY,
    -- 'textbook' = 教材小节; 'paper' = 爬取的前沿文献
    source_type  TEXT NOT NULL DEFAULT 'textbook',
    -- 教材：章节号 ch01；论文：留空
    chapter_id   TEXT,
    -- 教材小节的来源标记(复用前端 token, 如 ch01-s3)，论文用外部 id(如 arXiv id)
    token        TEXT UNIQUE,
    heading      TEXT,                 -- 小节标题 / 论文标题
    title        TEXT,                 -- 章节标题 / 期刊来源
    url          TEXT,                 -- 论文链接(教材为空)
    content      TEXT NOT NULL,        -- 被嵌入的正文(小节正文 / 论文摘要)
    embedding    vector(1024),         -- 见文件头维度说明
    metadata     JSONB DEFAULT '{}',   -- 作者/发表日期/分类/要点等
    published_at TIMESTAMPTZ,          -- 论文发表时间，用于"前沿"排序与时间过滤
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.knowledge_chunks IS 'RAG 向量库：教材小节 + 前沿论文，统一 embedding 空间';

-- 近似最近邻索引(余弦)。HNSW 需要 pgvector >= 0.5（Supabase 已支持）
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
    ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx
    ON public.knowledge_chunks (source_type);

-- ============================================
-- RLS：所有登录用户可读；写入仅 service_role(CI 灌库)，service_role 默认绕过 RLS
-- ============================================
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge readable by authenticated" ON public.knowledge_chunks;
CREATE POLICY "knowledge readable by authenticated"
    ON public.knowledge_chunks FOR SELECT TO authenticated
    USING (true);

-- ============================================
-- 向量检索 RPC：余弦相似度 Top-K，可按来源类型过滤
-- similarity = 1 - cosine_distance，范围约 [0,1]，越大越相关
-- ============================================
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector(1024),
    match_count     INT DEFAULT 5,
    min_similarity  FLOAT DEFAULT 0.30,
    filter_source   TEXT DEFAULT NULL
)
RETURNS TABLE (
    id          BIGINT,
    source_type TEXT,
    chapter_id  TEXT,
    token       TEXT,
    heading     TEXT,
    title       TEXT,
    url         TEXT,
    content     TEXT,
    metadata    JSONB,
    published_at TIMESTAMPTZ,
    similarity  FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        kc.id, kc.source_type, kc.chapter_id, kc.token, kc.heading,
        kc.title, kc.url, kc.content, kc.metadata, kc.published_at,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_chunks kc
    WHERE kc.embedding IS NOT NULL
      AND (filter_source IS NULL OR kc.source_type = filter_source)
      AND (1 - (kc.embedding <=> query_embedding)) >= min_similarity
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge TO authenticated;
