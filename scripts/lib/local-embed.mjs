// 本地 sentence-transformers 嵌入（Transformers.js, Node）。免费、无需 API key。
// ⚠️ 与 js/retriever.js 的 _EMBED_MODEL 必须一致，否则查询/文档向量不可比。
import { pipeline, env } from '@huggingface/transformers';

// 国内访问 huggingface.co 常超时，默认走 hf-mirror.com（HF_ENDPOINT 可覆盖）
env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';

export const EMBED_MODEL = 'Xenova/bge-small-zh-v1.5';
export const BGE_QUERY_PREFIX = '为这个句子生成表示以用于检索相关文章：';

export const round = (x) => Math.round(x * 1e4) / 1e4; // 4 位小数缩小体积

let _extractor;
export async function getEmbedder() {
  if (!_extractor) _extractor = await pipeline('feature-extraction', EMBED_MODEL);
  return _extractor;
}

// 文档(passage)嵌入：不加查询指令
export async function embedPassage(text) {
  const ex = await getEmbedder();
  const out = await ex(text, { pooling: 'cls', normalize: true });
  return Array.from(out.data, round);
}
