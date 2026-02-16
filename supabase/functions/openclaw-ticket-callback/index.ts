import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asErrorMessage,
  buildOpenClawCanonical,
  hmacSha256Hex,
  isTimestampWithinWindow,
  parseJsonSafely,
  safeEqual,
} from "../_shared/openclawBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openclaw-ts, x-openclaw-signature, x-openclaw-event-id, x-openclaw-request-id",
};

const CALLBACK_EVENTS = [
  "ticket.triaged",
  "ticket.analysis_ready",
  "ticket.solution_proposed",
  "ticket.resolved",
  "ticket.needs_human",
] as const;

type CallbackEventType = (typeof CALLBACK_EVENTS)[number];

interface CallbackPayload {
  event_id: string;
  event_type: CallbackEventType;
  ticket_id?: string;
  ticket_uuid?: string;
  hotel_id?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

function isCallbackEventType(value: string): value is CallbackEventType {
  return (CALLBACK_EVENTS as readonly string[]).includes(value);
}

function mapCallbackStatus(eventType: CallbackEventType): string {
  if (eventType === "ticket.triaged") return "triaged";
  if (eventType === "ticket.analysis_ready") return "in_progress";
  if (eventType === "ticket.solution_proposed") return "fixed";
  if (eventType === "ticket.resolved") return "closed";
  return "needs_human";
}

function sanitizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key || key.length > 120) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      out[key] = value;
    }
  }
  return out;
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

    const secret = Deno.env.get("OPENCLAW_WEBHOOK_SECRET");
    if (!secret) {
      throw new Error("OPENCLAW_WEBHOOK_SECRET not configured");
    }

    const timestampHeader = req.headers.get("x-openclaw-ts") ?? "";
    const signatureHeader = req.headers.get("x-openclaw-signature") ?? "";

    if (!timestampHeader || !signatureHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing HMAC headers", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isTimestampWithinWindow(timestampHeader, 300)) {
      return new Response(
        JSON.stringify({ success: false, error: "Timestamp outside allowed window", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.text();
    const expectedSignature = await hmacSha256Hex(
      secret,
      buildOpenClawCanonical({ timestampSeconds: timestampHeader, body: rawBody }),
    );

    if (!safeEqual(expectedSignature, signatureHeader.toLowerCase())) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = parseJsonSafely(rawBody);
    if (!parsed || typeof parsed !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = parsed as Record<string, unknown>;
    const eventId = String(payload.event_id ?? req.headers.get("x-openclaw-event-id") ?? "").trim();
    const eventTypeRaw = String(payload.event_type ?? "").trim();
    const ticketReadableId = String(payload.ticket_id ?? "").trim();
    const ticketUuid = String(payload.ticket_uuid ?? "").trim();
    const payloadHotelId = String(payload.hotel_id ?? "").trim() || null;

    if (!eventId) {
      return new Response(
        JSON.stringify({ success: false, error: "event_id is required", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isCallbackEventType(eventTypeRaw)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unsupported event_type", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ticketReadableId && !ticketUuid) {
      return new Response(
        JSON.stringify({ success: false, error: "ticket_id or ticket_uuid is required", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;

    let ticketQuery = supabase
      .from("support_tickets")
      .select("id, ticket_id, hotel_id, status, metadata")
      .limit(1);

    if (ticketUuid) {
      ticketQuery = ticketQuery.eq("id", ticketUuid);
    } else {
      ticketQuery = ticketQuery.eq("ticket_id", ticketReadableId);
    }

    if (payloadHotelId) {
      ticketQuery = ticketQuery.eq("hotel_id", payloadHotelId);
    }

    const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle();
    if (ticketError) throw ticketError;

    const hotelId = (ticket?.hotel_id as string | undefined) ?? payloadHotelId;
    if (!hotelId) {
      return new Response(
        JSON.stringify({ success: false, error: "hotel_id missing", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: inboxInsertError } = await supabase.from("support_ticket_inbox").insert({
      hotel_id: hotelId,
      ticket_id: (ticket?.id as string | undefined) ?? null,
      event_id: eventId,
      event_type: eventTypeRaw,
      payload,
      status: "received",
      request_id: requestId,
    });

    if (inboxInsertError) {
      if ((inboxInsertError as { code?: string }).code === "23505") {
        await supabase.from("support_ticket_bridge_logs").insert({
          hotel_id: hotelId,
          request_id: requestId,
          event_id: eventId,
          ticket_id: (ticket?.id as string | undefined) ?? null,
          direction: "inbound",
          event_type: eventTypeRaw,
          retries: 0,
          result: "ignored",
          http_status: 200,
          detail: "duplicate_event_id",
          payload,
        });

        return new Response(
          JSON.stringify({ success: true, duplicate: true, request_id: requestId, event_id: eventId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw inboxInsertError;
    }

    if (!ticket) {
      await supabase
        .from("support_ticket_inbox")
        .update({
          status: "failed",
          error: "ticket_not_found",
          processed_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      await supabase.from("support_ticket_bridge_logs").insert({
        hotel_id: hotelId,
        request_id: requestId,
        event_id: eventId,
        direction: "inbound",
        event_type: eventTypeRaw,
        retries: 0,
        result: "error",
        http_status: 404,
        detail: "ticket_not_found",
        payload,
      });

      return new Response(
        JSON.stringify({ success: false, error: "ticket_not_found", request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const started = performance.now();

    await supabase.from("support_ticket_events").insert({
      hotel_id: hotelId,
      ticket_id: ticket.id,
      event_id: `tev_cb_rx_${crypto.randomUUID().replaceAll("-", "")}`,
      event_type: "callback_received",
      note: `Callback recibido: ${eventTypeRaw}`,
      payload: {
        event_id: eventId,
        request_id: requestId,
      },
      actor_type: "openclaw",
      source: "webhook",
    });

    const mergedMetadata = {
      ...(ticket.metadata as Record<string, unknown> | null | undefined ?? {}),
      openclaw_last_event_id: eventId,
      openclaw_last_event_type: eventTypeRaw,
      openclaw_last_event_at: new Date().toISOString(),
      ...sanitizeMetadata(payload.metadata),
    };

    const nextStatus = mapCallbackStatus(eventTypeRaw);

    await supabase
      .from("support_tickets")
      .update({
        status: nextStatus,
        metadata: mergedMetadata,
      })
      .eq("id", ticket.id)
      .eq("hotel_id", hotelId);

    await supabase.from("support_ticket_events").insert({
      hotel_id: hotelId,
      ticket_id: ticket.id,
      event_id: `tev_cb_ok_${crypto.randomUUID().replaceAll("-", "")}`,
      event_type: "callback_processed",
      note:
        typeof payload.note === "string" && payload.note.trim().length > 0
          ? payload.note.slice(0, 500)
          : `Callback aplicado: ${eventTypeRaw}`,
      from_status: String(ticket.status),
      to_status: nextStatus,
      payload: {
        event_id: eventId,
        request_id: requestId,
      },
      actor_type: "openclaw",
      source: "webhook",
    });

    await supabase
      .from("support_ticket_inbox")
      .update({
        ticket_id: ticket.id,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    const latencyMs = Math.round(performance.now() - started);

    await supabase.from("support_ticket_bridge_logs").insert({
      hotel_id: hotelId,
      request_id: requestId,
      event_id: eventId,
      ticket_id: ticket.id,
      direction: "inbound",
      event_type: eventTypeRaw,
      latency_ms: latencyMs,
      retries: 0,
      result: "success",
      http_status: 200,
      detail: "callback_processed",
      payload,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        event_id: eventId,
        ticket_id: ticket.ticket_id,
        status: nextStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("openclaw-ticket-callback error:", error);
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
