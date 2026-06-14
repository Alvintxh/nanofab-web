-- 切换嵌入维度 1024 → 768（改用免费 Gemini text-embedding-004）
-- 表为空，直接重建 embedding 列、HNSW 索引与检索函数
DROP INDEX IF EXISTS public.knowledge_chunks_embedding_idx;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.knowledge_chunks ADD COLUMN embedding vector(768);
CREATE INDEX knowledge_chunks_embedding_idx
    ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

DROP FUNCTION IF EXISTS public.match_knowledge(vector, integer, double precision, text);
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector(768),
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
