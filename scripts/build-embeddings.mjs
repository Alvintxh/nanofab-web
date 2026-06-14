// 用本地 sentence-transformers(bge-small-zh, Transformers.js) 把教材小节嵌入，
// 产出静态 content/knowledge_index.json（随站点发布，浏览器端检索用）。
// 免费、无需任何 API key。用法: npm run build:embeddings
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTextbookChunks } from './lib/parse-textbook.mjs';
import { EMBED_MODEL, embedPassage } from './lib/local-embed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log(`嵌入模型 ${EMBED_MODEL}（首次会下载到本地缓存）`);
  const chunks = await parseTextbookChunks();
  console.log(`共 ${chunks.length} 节，开始嵌入…`);

  const items = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    items.push({
      token: c.token,
      chapterId: c.chapter_id,
      chapterTitle: c.title,
      heading: c.heading,
      content: c.content,
      insights: c.metadata?.insights || [],
      embedding: await embedPassage(c.embedText),
    });
    if ((i + 1) % 30 === 0) console.log(`  已嵌入 ${i + 1}/${chunks.length}`);
  }

  const dim = items[0]?.embedding.length || 0;
  const index = { model: EMBED_MODEL, dim, built_at: new Date().toISOString(), source: 'textbook', items };
  const outPath = join(ROOT, 'content/knowledge_index.json');
  await writeFile(outPath, JSON.stringify(index));
  console.log(`✓ 写出 ${outPath}（${items.length} 节，维度 ${dim}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
