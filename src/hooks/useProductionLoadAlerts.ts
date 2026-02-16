import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";

export type ProductionShift = "morning" | "afternoon" | "night";
export type LoadSeverity = "critical" | "medium" | "low";

export interface ProductionOverloadAlert {
  id: string;
  date: string;
  shift: ProductionShift;
  demandPax: number;
  capacityPax: number;
  loadPct: number;
  severity: LoadSeverity;
  detail: string;
}

const FALLBACK_SHIFT_CAPACITY: Record<ProductionShift, number> = {
  morning: 220,
  afternoon: 260,
  night: 160,
};

function normalizeShiftFromTime(eventTime: string | null): ProductionShift {
  if (!eventTime) return "afternoon";
  const hours = Number(eventTime.slice(0, 2));
  if (!Number.isFinite(hours)) return "afternoon";
  if (hours < 12) return "morning";
  if (hours < 19) return "afternoon";
  return "night";
}

function normalizeShiftToken(rawShift: string | null): ProductionShift | null {
  if (!rawShift) return null;
  const value = rawShift.trim().toLowerCase();
  if (value === "morning" || value === "m") return "morning";
  if (value === "afternoon" || value === "t" || value === "evening") return "afternoon";
  if (value === "night" || value === "n") return "night";
  return null;
}

function loadSeverity(loadPct: number): LoadSeverity | null {
  if (loadPct > 120) return "critical";
  if (loadPct > 100) return "medium";
  if (loadPct > 85) return "low";
  return null;
}

function shiftLabel(shift: ProductionShift): string {
  if (shift === "morning") return "Manana";
  if (shift === "afternoon") return "Tarde";
  return "Noche";
}

export function useProductionLoadAlerts(options?: { days?: number }) {
  const hotelId = useCurrentHotelId();
  const days = options?.days ?? 14;
  const today = new Date();
  const startDate = format(today, "yyyy-MM-dd");
  const endDate = format(addDays(today, days), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["production-overload-alerts", hotelId, days],
    enabled: !!hotelId,
    queryFn: async (): Promise<ProductionOverloadAlert[]> => {
      if (!hotelId) return [];

      const [eventsResult, forecastsResult, shiftsResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, event_date, event_time, status, pax, pax_estimated, pax_confirmed")
          .eq("hotel_id", hotelId)
          .gte("event_date", startDate)
          .lte("event_date", endDate)
          .neq("status", "cancelled"),
        supabase
          .from("forecasts")
          .select("forecast_date, breakfast_pax")
          .eq("hotel_id", hotelId)
          .gte("forecast_date", startDate)
          .lte("forecast_date", endDate),
        supabase
          .from("staff_shifts")
          .select("shift_date, shift_type, user_id")
          .eq("hotel_id", hotelId)
          .gte("shift_date", startDate)
          .lte("shift_date", endDate),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (forecastsResult.error) throw forecastsResult.error;
      if (shiftsResult.error) throw shiftsResult.error;

      const demandMap = new Map<string, number>();
      const capacityMap = new Map<string, number>();

      const addDemand = (date: string, shift: ProductionShift, pax: number) => {
        const key = `${date}::${shift}`;
        demandMap.set(key, (demandMap.get(key) ?? 0) + Math.max(Math.round(pax), 0));
      };
      const addCapacity = (date: string, shift: ProductionShift, capacity: number) => {
        const key = `${date}::${shift}`;
        capacityMap.set(key, (capacityMap.get(key) ?? 0) + Math.max(Math.round(capacity), 0));
      };

      for (const event of eventsResult.data ?? []) {
        const shift = normalizeShiftFromTime(event.event_time);
        const status = (event.status ?? "").toLowerCase();
        const estimated = Math.max(event.pax_estimated ?? 0, event.pax ?? 0, 0);
        const confirmed = Math.max(event.pax_confirmed ?? 0, 0);
        const pax = status === "draft" ? estimated * 0.7 : Math.max(confirmed, estimated);
        addDemand(event.event_date, shift, pax);
      }

      for (const forecast of forecastsResult.data ?? []) {
        addDemand(forecast.forecast_date, "morning", forecast.breakfast_pax ?? 0);
      }

      for (const shift of shiftsResult.data ?? []) {
        const normalizedShift = normalizeShiftToken(shift.shift_type);
        if (!normalizedShift) continue;
        addCapacity(shift.shift_date, normalizedShift, 75);
      }

      const keys = new Set<string>([...demandMap.keys(), ...capacityMap.keys()]);
      const alerts: ProductionOverloadAlert[] = [];

      for (const key of keys) {
        const [date, shiftRaw] = key.split("::");
        const shift = shiftRaw as ProductionShift;
        const demand = demandMap.get(key) ?? 0;
        const recordedCapacity = capacityMap.get(key) ?? 0;
        const capacity = recordedCapacity > 0 ? recordedCapacity : FALLBACK_SHIFT_CAPACITY[shift];
        if (capacity <= 0) continue;

        const loadPct = (demand / capacity) * 100;
        const severity = loadSeverity(loadPct);
        if (!severity) continue;

        alerts.push({
          id: `${date}-${shift}`,
          date,
          shift,
          demandPax: demand,
          capacityPax: capacity,
          loadPct: Number(loadPct.toFixed(1)),
          severity,
          detail: `${shiftLabel(shift)} ${date}: demanda ${demand} vs capacidad ${capacity}`,
        });
      }

      return alerts.sort((a, b) => {
        if (a.loadPct !== b.loadPct) return b.loadPct - a.loadPct;
        return a.date.localeCompare(b.date);
      });
    },
  });
}
