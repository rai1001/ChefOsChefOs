import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";

export interface EventCostVarianceRow {
  event_id: string;
  hotel_id: string;
  event_name: string;
  event_date: string;
  pax: number;
  baseline_cost_total: number | null;
  actual_cost_total: number | null;
  delta_amount: number | null;
  delta_pct: number | null;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useEventCostVariance(options?: { startDate?: string; endDate?: string }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["event_cost_variance", hotelId, options?.startDate, options?.endDate],
    queryFn: async () => {
      if (!hotelId) return [] as EventCostVarianceRow[];

      const startDate = options?.startDate ?? new Date().toISOString().slice(0, 10);
      const endDate =
        options?.endDate ??
        (() => {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          return date.toISOString().slice(0, 10);
        })();

      // Ensure baseline exists for current hotel events with assigned menus.
      const { data: baselineCandidatesRaw, error: baselineCandidateError } = await supabase
        .from("events")
        .select(`
          id,
          pax,
          menu_id,
          menu:menus(id, cost_per_pax)
        `)
        .eq("hotel_id", hotelId)
        .not("menu_id", "is", null)
        .gte("event_date", startDate)
        .lte("event_date", endDate);

      if (baselineCandidateError) throw baselineCandidateError;

      const baselineCandidates = (baselineCandidatesRaw ?? []) as Array<{
        id: string;
        pax: number | null;
        menu_id: string | null;
        menu?: { id: string; cost_per_pax: number | null } | null;
      }>;

      for (const event of baselineCandidates) {
        const baselineCost = (event.menu?.cost_per_pax ?? 0) * (event.pax ?? 0);
        await supabaseUntyped.from("event_cost_baseline").upsert(
          {
            hotel_id: hotelId,
            event_id: event.id,
            menu_id: event.menu_id,
            pax: event.pax ?? 0,
            baseline_cost_total: baselineCost,
            snapshot: {
              source: "deterministic_menu_cost",
              menu_cost_per_pax: event.menu?.cost_per_pax ?? 0,
              pax: event.pax ?? 0,
            },
          },
          { onConflict: "event_id" },
        );

        await supabaseUntyped.from("event_cost_actual").upsert(
          {
            hotel_id: hotelId,
            event_id: event.id,
            actual_cost_total: baselineCost,
            snapshot: {
              source: "fallback_baseline",
            },
          },
          { onConflict: "event_id" },
        );
      }

      let query = supabaseUntyped
        .from("event_cost_variance_view")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("event_date", { ascending: true });

      if (startDate) query = query.gte("event_date", startDate);
      if (endDate) query = query.lte("event_date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as EventCostVarianceRow[];
    },
    enabled: !!hotelId,
  });
}
