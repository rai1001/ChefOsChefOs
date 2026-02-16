import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface RuntimeErrorContext {
  hotelId: string | null;
  userId: string | null;
  route: string;
  roles: string[];
}

type RuntimeErrorKind =
  | "query_error"
  | "mutation_error"
  | "window_error"
  | "unhandled_rejection"
  | "status_probe_error";

const supabaseUntyped = supabase as unknown as SupabaseClient;
const dedupeWindowMs = 60_000;
const recentSignatures = new Map<string, number>();

let currentContext: RuntimeErrorContext = {
  hotelId: null,
  userId: null,
  route: "/",
  roles: [],
};

function compact(value: string | null | undefined, max = 800) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function toErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: compact(error.message, 600),
      stack: compact(error.stack, 1200),
    };
  }
  return {
    name: "UnknownError",
    message: compact(String(error), 600),
    stack: null,
  };
}

function shouldSkip(signature: string) {
  const now = Date.now();
  const previous = recentSignatures.get(signature);
  recentSignatures.set(signature, now);
  if (previous && now - previous < dedupeWindowMs) return true;
  if (recentSignatures.size > 200) {
    for (const [key, ts] of recentSignatures.entries()) {
      if (now - ts > dedupeWindowMs) {
        recentSignatures.delete(key);
      }
    }
  }
  return false;
}

export function setRuntimeErrorContext(context: Partial<RuntimeErrorContext>) {
  currentContext = {
    ...currentContext,
    ...context,
  };
}

export async function captureRuntimeError(
  kind: RuntimeErrorKind,
  error: unknown,
  metadata?: Record<string, unknown>,
) {
  const payload = {
    kind,
    route: currentContext.route,
    roles: currentContext.roles,
    metadata: metadata ?? {},
    error: toErrorPayload(error),
    captured_at: new Date().toISOString(),
  };

  const signature = `${kind}:${payload.route}:${payload.error.message ?? "unknown"}`;
  if (shouldSkip(signature)) return;

  console.error(`[runtime:${kind}]`, payload);

  if (!currentContext.hotelId) return;

  try {
    await supabaseUntyped.from("ops_audit_log").insert({
      hotel_id: currentContext.hotelId,
      actor_user_id: currentContext.userId,
      entity: "ui_error",
      action: kind,
      payload,
    });
  } catch (insertError) {
    console.error("[runtime:log_insert_failed]", insertError);
  }
}
