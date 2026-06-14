// 每周抓取微纳制造前沿论文(仅公开元数据+摘要)，本地 bge 嵌入，累积写
// content/papers_index.json（随站点发布，并入浏览器端 hybrid 检索）。无需向量数据库。
// 用法: node scripts/ingest-papers.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { summarizePaper } from './lib/llm.mjs';
import { EMBED_MODEL, embedPassage } from './lib/local-embed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content/papers_index.json');

const DAYS = Number(process.env.INGEST_DAYS ?? '8');
const MAX_PER_SOURCE = Number(process.env.INGEST_MAX ?? '25');
const KEEP = Number(process.env.PAPERS_KEEP ?? '300');     // 索引累积上限
const TERMS = (process.env.INGEST_TERMS ??
  'nanofabrication,nanolithography,nanoimprint,electron beam lithography,EUV lithography,reactive ion etching,atomic layer deposition,self-assembly nanostructure')
  .split(',').map((s) => s.trim()).filter(Boolean);

const sinceDate = new Date(Date.now() - DAYS * 864e5);

async function fetchArxiv() {
  const cats = ['cond-mat.mtrl-sci', 'physics.app-ph', 'cond-mat.mes-hall'];
  const catQ = cats.map((c) => `cat:${c}`).join('+OR+');
  const absQ = TERMS.slice(0, 6).map((t) => `abs:%22${encodeURIComponent(t)}%22`).join('+OR+');
  const url = `http://export.arxiv.org/api/query?search_query=(${catQ})+AND+(${absQ})` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${MAX_PER_SOURCE}`;
  const xml = await (await fetch(url, { headers: { 'User-Agent': 'nanofab-web/1.0' } })).text();
  const papers = [];
  for (const entry of xml.split('<entry>').slice(1)) {
    const pick = (tag) => (entry.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim();
    const id = pick('id') || '';
    const m = id.match(/arxiv\.org\/abs\/(.+)$/);
    if (!m) continue;
    const published = pick('published');
    if (published && new Date(published) < sinceDate) continue;
    papers.push({
      extId: `arxiv:${m[1]}`,
      url: `https://arxiv.org/abs/${m[1]}`,
      title: (pick('title') || '').replace(/\s+/g, ' '),
      abstract: (pick('summary') || '').replace(/\s+/g, ' '),
      published_at: published || null,
      authors: [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((a) => a[1].trim()),
      categories: [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((c) => c[1]),
      venue: 'arXiv',
    });
  }
  return papers;
}

function rebuildAbstract(inv) {
  if (!inv) return '';
  const words = [];
  for (const [w, positions] of Object.entries(inv)) for (const p of positions) words[p] = w;
  return words.join(' ');
}
async function fetchOpenAlex() {
  const search = encodeURIComponent(TERMS.slice(0, 4).join(' OR '));
  const from = sinceDate.toISOString().slice(0, 10);
  const mail = process.env.OPENALEX_MAILTO;
  const url = `https://api.openalex.org/works?search=${search}` +
    `&filter=from_publication_date:${from}&sort=publication_date:desc&per-page=${MAX_PER_SOURCE}` +
    (mail ? `&mailto=${mail}` : '');
  const data = await (await fetch(url)).json();
  return (data.results || []).map((w) => ({
    extId: `openalex:${(w.id || '').split('/').pop()}`,
    url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, '')}` : w.id,
    title: (w.display_name || '').replace(/\s+/g, ' '),
    abstract: rebuildAbstract(w.abstract_inverted_index).replace(/\s+/g, ' '),
    published_at: w.publication_date || null,
    authors: (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean).slice(0, 8),
    categories: (w.concepts || []).map((c) => c.display_name).slice(0, 5),
    venue: w.primary_location?.source?.display_name || 'OpenAlex',
  })).filter((p) => p.abstract && p.title);
}

async function loadExisting() {
  try {
    const data = JSON.parse(await readFile(OUT, 'utf8'));
    if (data.model !== EMBED_MODEL) { console.warn('索引模型不一致，重建'); return []; }
    return data.items || [];
  } catch { return []; }
}

async function main() {
  let fetched = [];
  for (const [name, fn] of [['arXiv', fetchArxiv], ['OpenAlex', fetchOpenAlex]]) {
    try { const got = await fn(); console.log(`${name}: ${got.length} 篇`); fetched.push(...got); }
    catch (e) { console.warn(`${name} 抓取失败:`, e.message); }
  }

  const existing = await loadExisting();
  const known = new Set(existing.map((it) => it.token));
  const seen = new Set();
  const fresh = fetched.filter((p) => p.abstract && !known.has(p.extId) && !seen.has(p.extId) && seen.add(p.extId));
  console.log(`去重后新增 ${fresh.length} 篇（已有 ${existing.length}）`);

  const newItems = [];
  for (const p of fresh) {
    const { summary, tags } = await summarizePaper({ title: p.title, abstract: p.abstract });
    const embedding = await embedPassage(`${p.title}\n${summary}\n${tags.join(' ')}`.slice(0, 2400));
    newItems.push({
      token: p.extId,
      sourceType: 'paper',
      chapterId: null,
      chapterTitle: p.venue,
      heading: p.title,
      content: summary,
      url: p.url,
      published_at: p.published_at,
      insights: tags,
      embedding,
    });
  }

  // 合并、按发表时间倒序、截断到 KEEP
  const merged = [...newItems, ...existing]
    .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
    .slice(0, KEEP);

  const dim = merged[0]?.embedding.length || 0;
  const index = { model: EMBED_MODEL, dim, built_at: new Date().toISOString(), source: 'paper', items: merged };
  await writeFile(OUT, JSON.stringify(index));
  console.log(`✓ 写出 ${OUT}（共 ${merged.length} 篇，新增 ${newItems.length}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
