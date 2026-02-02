import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, subDays, startOfMonth, endOfMonth } from "date-fns";

export interface DashboardStats {
  upcomingEvents: number;
  upcomingEventsPax: number;
  weeklyBreakfasts: number;
  pendingTasks: number;
  tasksInProgress: number;
  expiringLots: number;
  criticalAlerts: number;
}

export function useDashboardStats() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const next7Days = format(addDays(today, 7), "yyyy-MM-dd");
  // For "Eventos (mes actual)" we use the current calendar month
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Fetch events for current month (tarjeta Dashboard)
      const { data: events } = await supabase
        .from("events")
        .select("id, pax, event_date")
        .gte("event_date", monthStart)
        .lte("event_date", monthEnd);

      // Fetch forecasts for next 7 days
      const { data: forecasts } = await supabase
        .from("forecasts")
        .select("breakfast_pax")
        .gte("forecast_date", todayStr)
        .lte("forecast_date", next7Days);

      // Fetch pending tasks
      const { data: tasks } = await supabase
        .from("production_tasks")
        .select("id, status")
        .in("status", ["pending", "in_progress"]);

      // Fetch expiring inventory lots (next 7 days)
      const { data: lots } = await supabase
        .from("inventory_lots")
        .select("id, expiry_date")
        .gte("expiry_date", todayStr)
        .lte("expiry_date", next7Days)
        .gt("quantity", 0);

      const stats: DashboardStats = {
        upcomingEvents: events?.length || 0,
        upcomingEventsPax: events?.reduce((sum, e) => sum + (e.pax || 0), 0) || 0,
        weeklyBreakfasts: forecasts?.reduce((sum, f) => sum + (f.breakfast_pax || 0), 0) || 0,
        pendingTasks: tasks?.filter(t => t.status === "pending").length || 0,
        tasksInProgress: tasks?.filter(t => t.status === "in_progress").length || 0,
        expiringLots: lots?.length || 0,
        criticalAlerts: (lots?.filter(l => {
          const days = Math.ceil((new Date(l.expiry_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return days <= 2;
        }).length || 0),
      };

      return stats;
    },
  });
}

export function useUpcomingEvents(days: number = 7) {
  const today = new Date();
  // Show events for the current month (dashboard card)
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["upcoming-events", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          venue:venues(id, name),
          menu:menus(id, name)
        `)
        .gte("event_date", monthStart)
        .lte("event_date", monthEnd)
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useExpiringLots(days: number = 7) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const endDate = format(addDays(today, days), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["expiring-lots", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_lots")
        .select(`
          *,
          product:products(id, name)
        `)
        .gte("expiry_date", todayStr)
        .lte("expiry_date", endDate)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function usePendingTasks() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const next7Days = format(addDays(today, 7), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["pending-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_tasks")
        .select("*")
        .in("status", ["pending", "in_progress"])
        .lte("task_date", next7Days)
        .order("priority", { ascending: false })
        .order("task_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
