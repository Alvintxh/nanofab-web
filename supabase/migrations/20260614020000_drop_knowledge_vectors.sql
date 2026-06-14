-- 拆除向量库：检索已改为纯客户端 hybrid(BM25 + 本地 bge)，不再用 pgvector。
DROP FUNCTION IF EXISTS public.match_knowledge(vector, integer, double precision, text);
DROP TABLE IF EXISTS public.knowledge_chunks;
