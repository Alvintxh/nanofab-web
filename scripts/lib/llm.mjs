// 轻量 LLM 调用助手（Node / CI 用），默认智谱 glm-4-flash，可配置。
//   LLM_PROVIDER = zhipu | deepseek | gemini  (默认 zhipu)
//   LLM_MODEL    = glm-4-flash ...

const PROVIDER = process.env.LLM_PROVIDER ?? 'zhipu';

export async function chat(messages, { temperature = 0.3, maxTokens = 800 } = {}) {
  if (PROVIDER === 'zhipu') {
    const key = process.env.ZHIPU_API_KEY;
    if (!key) throw new Error('ZHIPU_API_KEY not configured');
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'glm-4-flash',
        messages, temperature, max_tokens: maxTokens,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Zhipu chat error');
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (PROVIDER === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error('DEEPSEEK_API_KEY not configured');
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'deepseek-chat',
        messages, temperature, max_tokens: maxTokens,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'DeepSeek chat error');
    return data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${PROVIDER}`);
}

// 把英文论文摘要提炼成中文摘要 + 主题标签，返回 {summary, tags[]}；失败则回退原摘要
export async function summarizePaper({ title, abstract }) {
  try {
    const raw = await chat([
      { role: 'system', content: '你是微纳制造领域的科研助手。把给定论文的标题与摘要提炼成中文。只输出一个 JSON 对象，不要代码块：{"summary":"150字内的中文摘要，突出方法与贡献","tags":["主题标签","3-5个"]}' },
      { role: 'user', content: `标题：${title}\n摘要：${abstract}`.slice(0, 4000) },
    ], { temperature: 0.2, maxTokens: 500 });
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const o = JSON.parse(m[0]);
      if (o.summary) return { summary: o.summary, tags: Array.isArray(o.tags) ? o.tags : [] };
    }
  } catch (e) {
    console.warn('summarize failed, use raw abstract:', e.message);
  }
  return { summary: abstract.slice(0, 600), tags: [] };
}
