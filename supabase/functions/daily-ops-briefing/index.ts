import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function deterministicBriefing(input: {
  date: string;
  plannedTaskCount: number;
  unplannedTaskCount: number;
  eventsCount: number;
}): string {
  return [
    `Plan diario ${input.date}:`,
    `- Tareas planificadas: ${input.plannedTaskCount}`,
    `- Tareas sin capacidad: ${input.unplannedTaskCount}`,
    `- Eventos del día: ${input.eventsCount}`,
    input.unplannedTaskCount > 0
      ? "- Recomendación: reasignar personal en los turnos críticos."
      : "- Recomendación: mantener ejecución y revisar mermas al cierre.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const briefing = deterministicBriefing({
      date: body.date ?? new Date().toISOString().slice(0, 10),
      plannedTaskCount: Number(body.plannedTaskCount ?? 0),
      unplannedTaskCount: Number(body.unplannedTaskCount ?? 0),
      eventsCount: Number(body.eventsCount ?? 0),
    });

    return new Response(
      JSON.stringify({ success: true, briefing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
