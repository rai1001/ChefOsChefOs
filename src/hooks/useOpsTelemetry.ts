import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { buildOpsAuditInsert } from "@/lib/telemetry";
import { captureRuntimeError } from "@/lib/runtimeErrorLogger";

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useOpsTelemetry() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();

  const logEvent = async (event: {
    entity: string;
    action: string;
    payload?: unknown;
  }) => {
    if (!hotelId) return;
    const insert = buildOpsAuditInsert({
      hotelId,
      entity: event.entity,
      action: event.action,
      payload: event.payload,
      actorUserId: user?.id ?? null,
    });
    try {
      await supabaseUntyped.from("ops_audit_log").insert(insert);
    } catch (error) {
      void captureRuntimeError("mutation_error", error, {
        source: "useOpsTelemetry",
        entity: event.entity,
        action: event.action,
      });
    }
  };

  return { logEvent };
}
