import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createCanonicalString,
  hasScope,
  isTimestampWithinWindow,
  sha256Hex,
  verifyEd25519Signature,
} from "../_shared/agentSignature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-id, x-agent-ts, x-agent-nonce, x-agent-signature",
};

const NONCE_TTL_SECONDS = 60;

function getRequiredScope(method: string, path: string): string | null {
  const normalizedPath = path.replace(/\/+$/, "");
  if (method === "GET" && normalizedPath.endsWith("/events")) return "read:events";
  if (method === "GET" && normalizedPath.endsWith("/tasks")) return "read:tasks";
  if (method === "POST" && normalizedPath.endsWith("/tasks/complete")) return "write:tasks";
  if (method === "GET" && normalizedPath.endsWith("/inventory")) return "read:inventory";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials missing");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;
    const url = new URL(req.url);

    const agentId = req.headers.get("x-agent-id") ?? "";
    const timestamp = req.headers.get("x-agent-ts") ?? "";
    const nonce = req.headers.get("x-agent-nonce") ?? "";
    const signature = req.headers.get("x-agent-signature") ?? "";

    if (!agentId || !timestamp || !nonce || !signature) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing signature headers" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isTimestampWithinWindow(timestamp, NONCE_TTL_SECONDS)) {
      return new Response(
        JSON.stringify({ success: false, error: "Timestamp outside allowed window" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: connection, error: connectionError } = await supabase
      .from("agent_connections")
      .select("*")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent connection not found or inactive" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requiredScope = getRequiredScope(req.method, url.pathname);
    if (!requiredScope) {
      return new Response(
        JSON.stringify({ success: false, error: "Unsupported route" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!hasScope(connection.allowed_scopes, requiredScope)) {
      return new Response(
        JSON.stringify({ success: false, error: "Scope not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowIso = new Date().toISOString();
    const { data: existingNonce } = await supabase
      .from("agent_nonces")
      .select("id")
      .eq("agent_connection_id", connection.id)
      .eq("nonce", nonce)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (existingNonce) {
      return new Response(
        JSON.stringify({ success: false, error: "Replay detected" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.text();
    const bodyHash = await sha256Hex(rawBody || "");
    const canonical = createCanonicalString({
      method: req.method,
      path: url.pathname,
      query: url.search,
      bodyHash,
      timestamp,
      nonce,
      agentId,
    });

    const isValid = await verifyEd25519Signature({
      canonical,
      signatureBase64: signature,
      publicKeyBase64: connection.public_key,
    });

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();
    await supabase.from("agent_nonces").insert({
      hotel_id: connection.hotel_id,
      agent_connection_id: connection.id,
      nonce,
      expires_at: expiresAt,
    });

    const parsedBody = rawBody ? JSON.parse(rawBody) : {};

    let responseData: unknown = null;
    if (requiredScope === "read:events") {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, event_time, pax, status")
        .eq("hotel_id", connection.hotel_id)
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      responseData = data;
    } else if (requiredScope === "read:tasks") {
      const { data, error } = await supabase
        .from("production_tasks")
        .select("id, title, task_date, shift, status, priority")
        .eq("hotel_id", connection.hotel_id)
        .order("task_date", { ascending: true })
        .limit(100);
      if (error) throw error;
      responseData = data;
    } else if (requiredScope === "write:tasks") {
      const taskId = parsedBody?.taskId;
      if (!taskId) {
        return new Response(
          JSON.stringify({ success: false, error: "taskId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data, error } = await supabase
        .from("production_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("hotel_id", connection.hotel_id)
        .select("id, title, status, completed_at")
        .single();
      if (error) throw error;
      responseData = data;
    } else if (requiredScope === "read:inventory") {
      const { data, error } = await supabase
        .from("inventory_lots")
        .select(`
          id,
          quantity,
          expiry_date,
          product:products(id, name)
        `)
        .eq("hotel_id", connection.hotel_id)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      responseData = data;
    }

    await supabase.from("ops_audit_log").insert({
      hotel_id: connection.hotel_id,
      entity: "agent_bridge",
      action: requiredScope,
      payload: {
        agent_id: connection.agent_id,
        path: url.pathname,
        method: req.method,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("agent-bridge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
