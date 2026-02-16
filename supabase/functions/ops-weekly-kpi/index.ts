import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { asErrorMessage } from "../_shared/opsAutopilot.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ops-kpi-token, x-ops-request-id",
};

interface WeeklyIncidentRow {
  id: string;
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  root_cause: string | null;
  runbook_slug: string | null;
  source: string;
  auto_remediation_state: string;
  status: string;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return out === 0;
}

async function authorizeRequest(req: Request, supabaseUrl: string, anonKey: string | null) {
  const cronToken = req.headers.get("x-ops-kpi-token") ?? "";
  const expectedCronToken = Deno.env.get("OPS_WEEKLY_KPI_TOKEN") ?? "";
  if (cronToken && expectedCronToken && safeEqual(cronToken, expectedCronToken)) {
    return { ok: true, mode: "cron" as const };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "missing_auth" };
  }

  if (!anonKey) {
    return { ok: false, reason: "anon_key_missing" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const authClient = createClient(supabaseUrl, anonKey) as unknown as SupabaseClient;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, reason: "invalid_token" };
  }

  return {
    ok: true,
    mode: "user" as const,
    user_id: data.user.id,
  };
}

function parseDateOnly(dateText: string): Date | null {
  const normalized = `${dateText.slice(0, 10)}T00:00:00.000Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfUtcWeekMonday(input: Date): Date {
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const weekday = date.getUTCDay();
  const diff = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function addDays(input: Date, days: number): Date {
  const output = new Date(input.getTime());
  output.setUTCDate(output.getUTCDate() + days);
  return output;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minutesDiff(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return (to.getTime() - from.getTime()) / 60_000;
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function inferRootCause(row: WeeklyIncidentRow): string {
  const direct = (row.root_cause ?? "").trim();
  if (direct.length > 0) return direct.slice(0, 120);
  if (row.runbook_slug) return row.runbook_slug;
  if (row.source) return row.source;
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = req.headers.get("x-ops-request-id") ?? crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? null;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials missing");
    }

    const auth = await authorizeRequest(req, supabaseUrl, anonKey);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", reason: auth.reason }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const hotelId = typeof body.hotel_id === "string" ? body.hotel_id : null;
    const weekStartInput = typeof body.week_start === "string" ? body.week_start : null;

    const now = new Date();
    const currentWeekStart = startOfUtcWeekMonday(now);
    const defaultWeekStart = addDays(currentWeekStart, -7);

    const weekStart = weekStartInput ? parseDateOnly(weekStartInput) : defaultWeekStart;
    if (!weekStart) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid week_start format", request_id: requestId }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const weekEndExclusive = addDays(weekStart, 7);
    const weekEndInclusive = addDays(weekEndExclusive, -1);

    let hotelsQuery = supabase.from("hotels").select("id");
    if (hotelId) {
      hotelsQuery = hotelsQuery.eq("id", hotelId);
    }

    const { data: hotels, error: hotelsError } = await hotelsQuery;
    if (hotelsError) throw hotelsError;

    const generated: Array<{
      hotel_id: string;
      week_start: string;
      total_incidents: number;
      auto_resolved_pct: number;
      mtta_minutes: number | null;
      mttr_minutes: number | null;
      root_causes: Array<{ cause: string; count: number }>;
    }> = [];

    for (const hotel of hotels ?? []) {
      const hotelIdValue = String(hotel.id);

      const { data: incidentsData, error: incidentsError } = await supabase
        .from("ops_incidents")
        .select(
          "id, opened_at, acknowledged_at, resolved_at, root_cause, runbook_slug, source, auto_remediation_state, status",
        )
        .eq("hotel_id", hotelIdValue)
        .gte("opened_at", weekStart.toISOString())
        .lt("opened_at", weekEndExclusive.toISOString())
        .order("opened_at", { ascending: true });

      if (incidentsError) throw incidentsError;

      const incidents = (incidentsData ?? []) as WeeklyIncidentRow[];
      const incidentIds = incidents.map((incident) => incident.id);

      let autoResolvedByEvent = new Set<string>();
      if (incidentIds.length > 0) {
        const { data: autoEvents, error: autoEventsError } = await supabase
          .from("ops_incident_events")
          .select("incident_id")
          .eq("hotel_id", hotelIdValue)
          .in("incident_id", incidentIds)
          .eq("event_type", "auto_resolved");

        if (autoEventsError) throw autoEventsError;
        autoResolvedByEvent = new Set((autoEvents ?? []).map((row) => String(row.incident_id)));
      }

      const totalIncidents = incidents.length;
      const autoResolvedCount = incidents.filter(
        (row) =>
          autoResolvedByEvent.has(row.id) ||
          (row.auto_remediation_state === "success" && row.status === "resolved"),
      ).length;

      const mttaValues = incidents
        .map((row) =>
          row.acknowledged_at ? minutesDiff(row.opened_at, row.acknowledged_at) : null,
        )
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

      const mttrValues = incidents
        .map((row) => (row.resolved_at ? minutesDiff(row.opened_at, row.resolved_at) : null))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

      const mtta = mttaValues.length > 0 ? round(mttaValues.reduce((acc, value) => acc + value, 0) / mttaValues.length) : null;
      const mttr = mttrValues.length > 0 ? round(mttrValues.reduce((acc, value) => acc + value, 0) / mttrValues.length) : null;

      const rootCauseCounter = new Map<string, number>();
      for (const row of incidents) {
        const cause = inferRootCause(row);
        rootCauseCounter.set(cause, (rootCauseCounter.get(cause) ?? 0) + 1);
      }

      const topRootCauses = [...rootCauseCounter.entries()]
        .map(([cause, count]) => ({ cause, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const autoResolvedPct = totalIncidents > 0 ? round((autoResolvedCount / totalIncidents) * 100) : 0;

      const snapshotRow = {
        hotel_id: hotelIdValue,
        week_start: toDateOnly(weekStart),
        week_end: toDateOnly(weekEndInclusive),
        total_incidents: totalIncidents,
        auto_resolved_pct: autoResolvedPct,
        mtta_minutes: mtta,
        mttr_minutes: mttr,
        root_causes: topRootCauses,
        generated_by: "system",
        generated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("ops_weekly_snapshots")
        .upsert(snapshotRow, { onConflict: "hotel_id,week_start" });

      if (upsertError) throw upsertError;

      generated.push({
        hotel_id: hotelIdValue,
        week_start: snapshotRow.week_start,
        total_incidents: totalIncidents,
        auto_resolved_pct: autoResolvedPct,
        mtta_minutes: mtta,
        mttr_minutes: mttr,
        root_causes: topRootCauses,
      });

      console.log(
        JSON.stringify({
          event: "weekly_snapshot_generated",
          request_id: requestId,
          hotel_id: hotelIdValue,
          week_start: snapshotRow.week_start,
          total_incidents: totalIncidents,
          auto_resolved_pct: autoResolvedPct,
        }),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        week_start: toDateOnly(weekStart),
        week_end: toDateOnly(weekEndInclusive),
        generated_count: generated.length,
        generated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ops-weekly-kpi error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        request_id: requestId,
        error: asErrorMessage(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
