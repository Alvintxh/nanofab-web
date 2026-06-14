// 共享 chat 助手（Deno / Edge Function 用），支持 zhipu/deepseek/gemini。
// 服务端密钥从环境变量读取；与 ai-proxy 的 provider 行为保持一致。
type Msg = { role: string; content: string };

export async function chatComplete(
  provider: string,
  model: string | undefined,
  messages: Msg[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const temperature = opts.temperature ?? 0.5;
  const max_tokens = opts.maxTokens ?? 1500;

  if (provider === "zhipu") {
    const key = Deno.env.get("ZHIPU_API_KEY");
    if (!key) throw new Error("ZHIPU_API_KEY not configured");
    const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "glm-4-flash", messages, temperature, max_tokens }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || "Zhipu API error");
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "deepseek") {
    const key = Deno.env.get("DEEPSEEK_API_KEY");
    if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "deepseek-chat", messages, temperature, max_tokens }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || "DeepSeek API error");
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");
    const sys = messages.find((m) => m.role === "system");
    const rest = messages.filter((m) => m.role !== "system");
    const prompt = (sys ? sys.content + "\n\n" : "") +
      rest.map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`).join("\n");
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.0-flash"}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: max_tokens },
        }),
      },
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || "Gemini API error");
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}
