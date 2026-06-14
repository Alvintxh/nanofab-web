// 把 content/chapters/*.html 解析成小节 chunk（不含嵌入/入库，纯解析，无需密钥）。
// 切分逻辑与前端 buildContentIndex 对齐，token 一致(ch01-s3)，保证出处可跳转。
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function flattenChapters(json) {
  const out = [];
  (json.parts || []).forEach((p) => (p.chapters || []).forEach((c) => out.push(c)));
  return out;
}

function splitSections(html, ch) {
  const root = parse(html);
  const container = root.querySelector('.chapter-content') || root;
  const sections = [];
  let cur = null;
  let idx = 0;
  const start = (heading) => ({
    chapterId: ch.id, chapterTitle: ch.title, heading,
    token: `${ch.id}-s${idx++}`, text: '', insights: [],
  });
  const flush = () => { if (cur && cur.text.trim()) sections.push(cur); cur = null; };

  container.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return;
    const tag = (node.tagName || '').toUpperCase();
    if (tag === 'H1') return;
    if (tag === 'H2' || tag === 'H3') { flush(); cur = start(node.text.trim()); return; }
    if (!cur) cur = start(ch.title);
    const t = node.text.replace(/\s+/g, ' ').trim();
    if (t) cur.text += t + '\n';
    node.querySelectorAll('.key-insight').forEach((k) => cur.insights.push(k.text.trim()));
  });
  flush();
  return sections;
}

// 返回可直接入库的 chunk 数组（含 embedText / content / metadata）
export async function parseTextbookChunks() {
  const chaptersJson = JSON.parse(await readFile(join(ROOT, 'content/chapters.json'), 'utf8'));
  const chapters = flattenChapters(chaptersJson);

  const chunks = [];
  for (const ch of chapters) {
    let html;
    try {
      html = await readFile(join(ROOT, `content/chapters/${ch.id}.html`), 'utf8');
    } catch {
      console.warn(`跳过 ${ch.id}（文件缺失）`);
      continue;
    }
    const sections = splitSections(html, ch);
    for (const s of sections) {
      const insights = s.insights.join('；');
      const content = s.text.slice(0, 2000).trim();
      chunks.push({
        source_type: 'textbook',
        chapter_id: s.chapterId,
        token: s.token,
        heading: s.heading,
        title: s.chapterTitle,
        content,
        embedText: `${s.chapterTitle} ${s.heading}\n${insights}\n${content}`.slice(0, 2400),
        metadata: { insights: s.insights },
      });
    }
    console.log(`${ch.id} ${ch.title}: ${sections.length} 节`);
  }
  return chunks;
}
