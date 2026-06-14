// 动态出题 Edge Function：基于教材原文(RAG接地) + 用户画像/轨迹生成单选题。
// 输入: { chapterId, count?, userContext?, provider?, model? }
// 输出: { questions: [{ question, options:{a,b,c,d}, correct, explanation }] }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatComplete } from "../_shared/chat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Missing authorization token" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${authHeader}` } },
      },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { chapterId, count, userContext, provider, model, material: rawMaterial } = await req.json();
    if (!chapterId) return json({ error: "Missing chapterId" }, 400);
    const n = Math.min(Math.max(Number(count) || 5, 1), 10);

    // RAG 接地：教材原文由客户端从本地知识索引拼接后传入（不再依赖 pgvector）
    const material = String(rawMaterial || "").slice(0, 7000);
    if (!material) return json({ error: "缺少出题材料，无法出题" }, 422);

    const system = [
      "你是纳米制造课程的命题老师。只能依据【教材材料】出单项选择题，不得引入材料之外的事实，正确答案必须能在材料中找到依据。",
      "根据【用户情况】调整难度与考点：水平低则考概念与定义；水平高则考机制、参数与工艺权衡；优先覆盖用户的薄弱环节。",
      "每题恰好 4 个选项，只有 1 个正确；干扰项要合理、不要明显荒谬；不要出现“以上都对/都不对”。",
      `只输出一个 JSON 数组(不要任何额外文字、不要代码块)，含 ${n} 道题，元素格式：`,
      '{"question":"题干","options":{"a":"选项A","b":"选项B","c":"选项C","d":"选项D"},"correct":"a|b|c|d 之一","explanation":"简短解析，说明为何正确"}',
    ].join("\n");

    const userMsg =
      `【用户情况】\n${userContext || "水平未知"}\n\n【教材材料】\n${material}\n\n请据此出 ${n} 道单选题。`;

    const raw = await chatComplete(provider || "zhipu", model, [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ], { temperature: 0.6, maxTokens: 2200 });

    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return json({ error: "生成结果解析失败" }, 502);
    let parsed: unknown;
    try { parsed = JSON.parse(m[0]); } catch { return json({ error: "生成结果非合法JSON" }, 502); }

    // 校验：4 选项 + correct 合法，剔除不合格题目
    const questions = (Array.isArray(parsed) ? parsed : [])
      .filter((q: Record<string, unknown>) => {
        const opts = q?.options as Record<string, string> | undefined;
        return q && typeof q.question === "string" && opts &&
          ["a", "b", "c", "d"].every((k) => typeof opts[k] === "string") &&
          ["a", "b", "c", "d"].includes(q.correct as string);
      })
      .slice(0, n);

    if (!questions.length) return json({ error: "未生成有效题目，请重试" }, 502);
    return json({ questions });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
