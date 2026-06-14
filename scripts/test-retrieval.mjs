// 稠密检索快速验证：用 bge 嵌入查询，对 knowledge_index.json 算余弦 Top-5。
// 用法: node scripts/test-retrieval.mjs "你的问题"
import { pipeline, env } from '@huggingface/transformers';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '为这个句子生成表示以用于检索相关文章：';

async function main() {
  const queries = process.argv.slice(2);
  const qs = queries.length ? queries : ['为什么芯片越做越小越来越难', 'lithography 分辨率极限', '怎么把图案变小'];
  const idx = JSON.parse(await readFile(join(ROOT, 'content/knowledge_index.json'), 'utf8'));
  const ex = await pipeline('feature-extraction', idx.model);

  for (const q of qs) {
    const out = await ex(PREFIX + q, { pooling: 'cls', normalize: true });
    const qv = Array.from(out.data);
    const scored = idx.items.map(it => {
      let dot = 0; for (let d = 0; d < qv.length; d++) dot += qv[d] * it.embedding[d];
      return { s: dot, it };
    }).sort((a, b) => b.s - a.s).slice(0, 5);
    console.log(`\n■ 查询：${q}`);
    scored.forEach((x, i) => console.log(`  ${i + 1}. [${x.s.toFixed(3)}] ${x.it.chapterId} ${x.it.heading}`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
