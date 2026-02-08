import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { messages, type } = await req.json();

    // Require authenticated user for this function.
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseKey) {
      throw new Error("Service role key is not configured");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let hotelContext = "";

    // Get user's hotel
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_hotel_id")
      .eq("id", user.id)
      .single();

    if (profile?.current_hotel_id) {
      // Fetch context data based on type
      if (type === "chat" || type === "suggest_menu") {
        // Get upcoming events
        const { data: events } = await supabase
          .from("events")
          .select("name, event_date, pax, status")
          .eq("hotel_id", profile.current_hotel_id)
          .gte("event_date", new Date().toISOString().split("T")[0])
          .order("event_date")
          .limit(10);

        // Get menus
        const { data: menus } = await supabase
          .from("menus")
          .select("name, type, cost_per_pax, description")
          .eq("hotel_id", profile.current_hotel_id)
          .eq("is_active", true)
          .limit(20);

        // Get pending tasks
        const { data: tasks } = await supabase
          .from("production_tasks")
          .select("title, task_date, shift, status, priority")
          .eq("hotel_id", profile.current_hotel_id)
          .eq("status", "pending")
          .limit(10);

        hotelContext = `
CONTEXTO DEL HOTEL:
- Próximos eventos (${events?.length || 0}): ${JSON.stringify(events || [])}
- Menús disponibles (${menus?.length || 0}): ${JSON.stringify(menus || [])}
- Tareas pendientes (${tasks?.length || 0}): ${JSON.stringify(tasks || [])}
`;
      }
    }

    // Build system prompt based on type
    let systemPrompt = "";

    if (type === "suggest_menu") {
      systemPrompt = `Eres un asistente de cocina experto. Tu trabajo es sugerir el menú más apropiado basándote en:
- El tipo de evento
- El número de comensales (pax)
- Los menús disponibles en el sistema

${hotelContext}

INSTRUCCIONES:
- Analiza el evento proporcionado
- Sugiere el menú más adecuado de los disponibles
- Explica brevemente por qué es la mejor opción
- Si no hay menús adecuados, sugiere crear uno nuevo
- Responde en español, de forma concisa`;
    } else {
      // Default chat assistant
      systemPrompt = `Eres ChefOS AI, un asistente inteligente para gestión de cocina de hotel. Puedes:
- Responder consultas sobre eventos, menús y tareas
- Dar resúmenes del día o semana
- Sugerir acciones basadas en el contexto

${hotelContext}

INSTRUCCIONES:
- Responde siempre en español
- Sé conciso y directo
- Usa formato markdown cuando sea útil
- Si no tienes datos suficientes, indica qué información necesitas`;
    }

    // Convert OpenAI-style messages to Gemini contents
    const contents =
      Array.isArray(messages) && messages.length
        ? messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))
        : [];

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok || !geminiResponse.body) {
      const errorText = await geminiResponse.text();
      console.error("Gemini error:", geminiResponse.status, errorText);
      const status =
        geminiResponse.status === 429 ? 429 : geminiResponse.status || 500;
      const message =
        geminiResponse.status === 429
          ? "Demasiadas solicitudes a Gemini. Intenta de nuevo en unos segundos."
          : "Error del servicio de IA";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream Gemini chunks, adapting to OpenAI-compatible SSE expected by frontend
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      const reader = geminiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const raw of lines) {
            const line = raw.trim();
            if (!line || !line.startsWith("data:")) continue;

            const dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") {
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              continue;
            }

            try {
              const json = JSON.parse(dataStr);
              const text =
                json.candidates?.[0]?.content?.parts
                  ?.map((p: { text?: string }) => p.text || "")
                  .join("") || "";
              if (text) {
                const payload = { choices: [{ delta: { content: text } }] };
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
                );
              }
            } catch (err) {
              console.error("Failed to parse Gemini stream chunk:", err);
            }
          }
        }
      } finally {
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-assistant error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
