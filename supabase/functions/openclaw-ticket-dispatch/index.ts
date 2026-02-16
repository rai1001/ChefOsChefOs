import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asErrorMessage,
  buildOpenClawCanonical,
  hmacSha256Hex,
} from "../_shared/openclawBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openclaw-request-id",
};

interface OutboxRow {
  id: string;
  hotel_id: string;
  ticket_id: string;
  event_id: string;
  event_type: "ticket.created" | "ticket.updated" | "ticket.escalated";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "sent" | "failed";
  attempt_count: number;
  max_attempts: number;
}

function nextRetryInfo(attemptCount: number, maxAttempts: number) {
  const exhausted = attemptCount >= maxAttempts;
  const delaySeconds = Math.min(300, 5 * 2 ** Math.max(0, attemptCount - 1));
  return {
    exhausted,
    delaySeconds,
  };
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

  const requestId = req.headers.get("x-openclaw-request-id") ?? crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials missing");
    }

    const webhookUrl =
      Deno.env.get("OPENCLAW_TICKETS_WEBHOOK_URL") ??
      Deno.env.get("OPENCLAW_WEBHOOK_URL") ??
      Deno.env.get("CLAWTBOT_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("OPENCLAW_WEBHOOK_SECRET") ?? "";

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          request_id: requestId,
          error: "OPENCLAW_TICKETS_WEBHOOK_URL not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const hotelId = typeof body.hotel_id === "string" ? body.hotel_id : null;
    const maxBatchRaw = Number(body.max_batch ?? 20);
    const maxBatch = Number.isFinite(maxBatchRaw) ? Math.min(Math.max(Math.floor(maxBatchRaw), 1), 100) : 20;

    let query = supabase
      .from("support_ticket_outbox")
      .select("id, hotel_id, ticket_id, event_id, event_type, payload, status, attempt_count, max_attempts")
      .in("status", ["pending", "failed"])
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(maxBatch);

    if (hotelId) {
      query = query.eq("hotel_id", hotelId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as OutboxRow[];

    let sent = 0;
    let failed = 0;
    let ignored = 0;

    for (const row of rows) {
      const now = new Date();
      const timestampSeconds = Math.floor(now.getTime() / 1000).toString();
      const rowRequestId = `${requestId}:${row.event_id}`;

      const { data: lockedRows, error: lockError } = await supabase
        .from("support_ticket_outbox")
        .update({
          status: "processing",
          locked_at: now.toISOString(),
          request_id: rowRequestId,
        })
        .eq("id", row.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .limit(1);

      if (lockError) {
        failed += 1;
        continue;
      }

      if (!lockedRows || lockedRows.length === 0) {
        ignored += 1;
        continue;
      }

      const outboundPayload = {
        event_id: row.event_id,
        event_type: row.event_type,
        occurred_at: now.toISOString(),
        ticket: row.payload,
        source: "chefos",
      };
      const outboundRaw = JSON.stringify(outboundPayload);

      const signature = webhookSecret
        ? await hmacSha256Hex(
            webhookSecret,
            buildOpenClawCanonical({ timestampSeconds, body: outboundRaw }),
          )
        : "";

      const started = performance.now();
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chefos-ts": timestampSeconds,
          "x-chefos-event-id": row.event_id,
          "x-chefos-request-id": rowRequestId,
          ...(signature ? { "x-chefos-signature": signature } : {}),
        },
        body: outboundRaw,
      }).catch((fetchError) => {
        return {
          ok: false,
          status: 0,
          text: async () => asErrorMessage(fetchError),
        } as Response;
      });
      const latencyMs = Math.round(performance.now() - started);
      const attemptCount = row.attempt_count + 1;

      if (response.ok) {
        sent += 1;

        await supabase.from("support_ticket_outbox").update({
          status: "sent",
          attempt_count: attemptCount,
          sent_at: now.toISOString(),
          last_http_status: response.status,
          last_error: null,
          next_retry_at: now.toISOString(),
          request_id: rowRequestId,
          locked_at: null,
        }).eq("id", row.id);

        await supabase.from("support_ticket_events").insert({
          hotel_id: row.hotel_id,
          ticket_id: row.ticket_id,
          event_id: `tev_dispatch_${crypto.randomUUID().replaceAll("-", "")}`,
          event_type: "dispatched",
          note: `Evento ${row.event_type} enviado a OpenClaw`,
          payload: {
            event_id: row.event_id,
            event_type: row.event_type,
            http_status: response.status,
            request_id: rowRequestId,
            latency_ms: latencyMs,
          },
          actor_type: "system",
          source: "system",
        });

        await supabase.from("support_ticket_bridge_logs").insert({
          hotel_id: row.hotel_id,
          request_id: rowRequestId,
          event_id: row.event_id,
          ticket_id: row.ticket_id,
          direction: "outbound",
          event_type: row.event_type,
          latency_ms: latencyMs,
          retries: row.attempt_count,
          result: "success",
          http_status: response.status,
          detail: "dispatched",
          payload: outboundPayload,
        });

        continue;
      }

      failed += 1;
      const errorText = await response.text().catch(() => "unknown error");
      const retry = nextRetryInfo(attemptCount, row.max_attempts);
      const nextRetryAt = new Date(now.getTime() + retry.delaySeconds * 1000);

      await supabase.from("support_ticket_outbox").update({
        status: retry.exhausted ? "failed" : "pending",
        attempt_count: attemptCount,
        next_retry_at: nextRetryAt.toISOString(),
        last_http_status: response.status,
        last_error: errorText.slice(0, 1000),
        request_id: rowRequestId,
        locked_at: null,
      }).eq("id", row.id);

      await supabase.from("support_ticket_events").insert({
        hotel_id: row.hotel_id,
        ticket_id: row.ticket_id,
        event_id: `tev_dispatch_fail_${crypto.randomUUID().replaceAll("-", "")}`,
        event_type: "dispatch_failed",
        note: `Fallo envio OpenClaw (${response.status || "network"})`,
        payload: {
          event_id: row.event_id,
          event_type: row.event_type,
          http_status: response.status,
          request_id: rowRequestId,
          latency_ms: latencyMs,
          error: errorText.slice(0, 500),
          next_retry_at: nextRetryAt.toISOString(),
          exhausted: retry.exhausted,
        },
        actor_type: "system",
        source: "system",
      });

      await supabase.from("support_ticket_bridge_logs").insert({
        hotel_id: row.hotel_id,
        request_id: rowRequestId,
        event_id: row.event_id,
        ticket_id: row.ticket_id,
        direction: "outbound",
        event_type: row.event_type,
        latency_ms: latencyMs,
        retries: attemptCount,
        result: "error",
        http_status: response.status,
        detail: errorText.slice(0, 300),
        payload: outboundPayload,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        processed: rows.length,
        sent,
        failed,
        ignored,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("openclaw-ticket-dispatch error:", error);
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
