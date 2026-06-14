// 客户端 Hybrid 检索模块 — 混入 App (Object.assign)
// BM25(稀疏，立即可用) + bge-small-zh(稠密，Transformers.js 本地嵌入) → RRF 融合
// 全部在浏览器跑：零 API key、零后端、零成本。文档向量来自 content/knowledge_index.json
const RetrieverModule = {

    // ⚠️ 必须与 scripts/build-embeddings.mjs 的 EMBED_MODEL 一致
    _EMBED_MODEL: 'Xenova/bge-small-zh-v1.5',
    // bge 中文检索的查询指令（仅查询加，文档不加）
    _BGE_QUERY_PREFIX: '为这个句子生成表示以用于检索相关文章：',

    // ---- 知识索引（文档向量 + 文本）----
    async _loadKnowledgeIndex() {
        if (this._knowledgeIndex) return this._knowledgeIndex;
        if (this._knowledgeIndexPromise) return this._knowledgeIndexPromise;
        this._knowledgeIndexPromise = (async () => {
            const loadOne = async (path) => {
                try {
                    const resp = await fetch(path);
                    if (!resp.ok) return [];
                    const data = await resp.json();
                    return data.items || [];
                } catch (e) { return []; }
            };
            // 教材索引（必需）+ 论文索引（可选，每周爬取生成）
            const [book, papers] = await Promise.all([
                loadOne('./content/knowledge_index.json'),
                loadOne('./content/papers_index.json'),
            ]);
            if (!book.length && !papers.length) return null;
            const items = [...book, ...papers];
            this._knowledgeIndex = { items };
            this._buildBM25(items);
            return this._knowledgeIndex;
        })();
        return this._knowledgeIndexPromise;
    },

    // ---- 嵌入模型（懒加载；首次拉取模型，之后浏览器缓存）----
    async _ensureEmbedder() {
        if (this._embedder) return this._embedder;
        if (this._embedderPromise) return this._embedderPromise;
        this._embedderPromise = (async () => {
            const TJS = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.0');
            TJS.env.allowLocalModels = false;
            // 国内从 huggingface.co 拉模型常被墙/超时 → 走镜像
            TJS.env.remoteHost = 'https://hf-mirror.com';
            const extractor = await TJS.pipeline('feature-extraction', this._EMBED_MODEL);
            this._embedder = extractor;
            return extractor;
        })().catch(e => { console.warn('嵌入模型加载失败，仅用 BM25：', e.message); this._embedderPromise = null; return null; });
        return this._embedderPromise;
    },

    // 提前预热模型（不阻塞），让用户首问时大概率已就绪
    preloadEmbedder() { this._loadKnowledgeIndex(); this._ensureEmbedder(); },

    async _embedQuery(text) {
        const extractor = await this._ensureEmbedder();
        if (!extractor) return null;
        const out = await extractor(this._BGE_QUERY_PREFIX + text, { pooling: 'cls', normalize: true });
        return Array.from(out.data);
    },

    // ---- 中文分词（Intl.Segmenter 优先，退化到字符 bigram）----
    _tokenize(text) {
        const clean = (text || '').toLowerCase();
        const toks = [];
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            if (!this._seg) this._seg = new Intl.Segmenter('zh', { granularity: 'word' });
            for (const s of this._seg.segment(clean)) {
                const w = s.segment.trim();
                if (w && /[\w一-龥]/.test(w)) toks.push(w);
            }
        } else {
            const z = clean.replace(/[^\w一-龥]/g, '');
            for (let i = 0; i + 2 <= z.length; i++) toks.push(z.slice(i, i + 2));
        }
        return toks;
    },

    // ---- BM25 索引 ----
    _buildBM25(items) {
        const docs = items.map(it => this._tokenize(`${it.heading} ${it.content} ${(it.insights || []).join(' ')}`));
        const N = docs.length;
        const df = {};
        const docTF = [];
        let totalLen = 0;
        docs.forEach(toks => {
            const tf = {};
            toks.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
            docTF.push({ tf, len: toks.length });
            totalLen += toks.length;
            Object.keys(tf).forEach(t => { df[t] = (df[t] || 0) + 1; });
        });
        const idf = {};
        Object.keys(df).forEach(t => { idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5)); });
        this._bm25 = { docTF, idf, avgdl: N ? totalLen / N : 0, N, k1: 1.5, b: 0.75 };
    },

    _bm25Search(query, topN) {
        const m = this._bm25;
        if (!m || !m.N) return [];
        const qToks = [...new Set(this._tokenize(query))];
        const scores = new Array(m.N).fill(0);
        qToks.forEach(t => {
            const idf = m.idf[t];
            if (!idf) return;
            for (let i = 0; i < m.N; i++) {
                const tf = m.docTF[i].tf[t];
                if (!tf) continue;
                const denom = tf + m.k1 * (1 - m.b + m.b * m.docTF[i].len / m.avgdl);
                scores[i] += idf * (tf * (m.k1 + 1)) / denom;
            }
        });
        return scores.map((s, i) => ({ i, s })).filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s).slice(0, topN).map(x => x.i);
    },

    async _denseSearch(query, topN) {
        const idx = this._knowledgeIndex;
        if (!idx?.items?.length) return [];
        const qv = await this._embedQuery(query);
        if (!qv) return [];
        const items = idx.items;
        const scored = new Array(items.length);
        for (let i = 0; i < items.length; i++) {
            const e = items[i].embedding;
            let dot = 0;
            for (let d = 0; d < qv.length; d++) dot += qv[d] * e[d]; // 已归一化 → 点积=余弦
            scored[i] = { i, s: dot };
        }
        return scored.sort((a, b) => b.s - a.s).slice(0, topN).map(x => x.i);
    },

    // ---- Hybrid：BM25 + 稠密，RRF 融合 ----
    async _hybridRetrieve(query, maxSections = 4, charBudget = 7000) {
        const q = (query || '').replace(/请解释这段内容|关于这段内容|我的问题|[「」：:]/g, ' ').trim();
        if (!q) return [];
        const idx = await this._loadKnowledgeIndex();
        if (!idx?.items?.length) return [];
        const items = idx.items;

        const bm25Ranks = this._bm25Search(q, 20);
        // 稠密仅在模型已就绪时使用；未就绪则本轮只用 BM25，并触发后台加载
        let denseRanks = [];
        if (this._embedder) {
            denseRanks = await this._denseSearch(q, 20).catch(() => []);
        } else {
            this._ensureEmbedder();
        }

        // Reciprocal Rank Fusion
        const k = 60;
        const fused = {};
        bm25Ranks.forEach((docI, r) => { fused[docI] = (fused[docI] || 0) + 1 / (k + r); });
        denseRanks.forEach((docI, r) => { fused[docI] = (fused[docI] || 0) + 1 / (k + r); });
        const order = Object.keys(fused).map(Number).sort((a, b) => fused[b] - fused[a]);

        const picked = [];
        let used = 0;
        for (const docI of order) {
            if (picked.length >= maxSections) break;
            const it = items[docI];
            const snippet = (it.content || '').slice(0, 2200).trim();
            if (used + snippet.length > charBudget && picked.length) break;
            picked.push({
                token: it.token,
                chapterId: it.chapterId,
                chapterTitle: it.chapterTitle,
                heading: it.heading,
                insights: it.insights || [],
                snippet,
                url: it.url,
                sourceType: it.sourceType,
            });
            used += snippet.length;
        }
        return picked;
    }

};
