import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${authHeader}` } },
    });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider, model, messages, temperature, max_tokens, web_search } = await req.json();

    if (!provider || !messages?.length) {
      return new Response(
        JSON.stringify({ error: "Missing provider or messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { content: string; error?: string; search?: any[] };

    switch (provider) {
      case "zhipu": {
        const key = Deno.env.get("ZHIPU_API_KEY");
        if (!key) {
          result = { content: "", error: "Zhipu API key not configured" };
          break;
        }
        const body: Record<string, unknown> = {
          model: model || "glm-4-flash",
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens ?? 1500,
        };
        // 开启联网搜索：返回真实网页/论文等外部参考来源
        if (web_search) {
          body.tools = [{ type: "web_search", web_search: { enable: true, search_result: true } }];
        }
        const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (resp.ok && data.choices?.[0]?.message?.content) {
          result = { content: data.choices[0].message.content };
          if (Array.isArray(data.web_search) && data.web_search.length) {
            result.search = data.web_search.map((r: any) => ({
              title: r.title || "",
              link: r.link || r.url || "",
              media: r.media || "",
            })).filter((r: any) => r.link);
          }
        } else {
          result = { content: "", error: data.error?.message || "Zhipu API error" };
        }
        break;
      }

      case "deepseek": {
        const key = Deno.env.get("DEEPSEEK_API_KEY");
        if (!key) {
          result = { content: "", error: "DeepSeek API key not configured" };
          break;
        }
        const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model || "deepseek-chat",
            messages,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens ?? 1500,
          }),
        });
        const data = await resp.json();
        if (resp.ok && data.choices?.[0]?.message?.content) {
          result = { content: data.choices[0].message.content };
        } else {
          result = { content: "", error: data.error?.message || "DeepSeek API error" };
        }
        break;
      }

      case "gemini": {
        const key = Deno.env.get("GEMINI_API_KEY");
        if (!key) {
          result = { content: "", error: "Gemini API key not configured" };
          break;
        }
        // Convert OpenAI-format messages to Gemini format
        const systemMsg = messages.find((m: any) => m.role === "system");
        const userMsgs = messages.filter((m: any) => m.role !== "system");
        const promptText = (systemMsg ? systemMsg.content + "\n\n" : "") +
          userMsgs.map((m: any) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`).join("\n");

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.0-flash"}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: temperature ?? 0.7,
                maxOutputTokens: max_tokens ?? 1500,
              },
            }),
          }
        );
        const data = await resp.json();
        if (resp.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          result = { content: data.candidates[0].content.parts[0].text };
        } else {
          result = { content: "", error: data.error?.message || "Gemini API error" };
        }
        break;
      }

      default:
        result = { content: "", error: `Unknown provider: ${provider}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ content: "", error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
