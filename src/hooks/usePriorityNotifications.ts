import { useQuery } from "@tanstack/react-query";
import { addDays, format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";

export type PriorityLevel = "critical" | "medium" | "low";

export interface PriorityNotification {
  id: string;
  level: PriorityLevel;
  title: string;
  detail: string;
  ctaTo: string;
}

function mapPriorityToLevel(priority: string | null): PriorityLevel {
  if (priority === "urgent" || priority === "high") return "critical";
  if (priority === "medium") return "medium";
  return "low";
}

export function usePriorityNotifications() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["priority-notifications", hotelId, user?.id],
    enabled: !!hotelId && !!user?.id,
    queryFn: async (): Promise<PriorityNotification[]> => {
      if (!hotelId || !user?.id) return [];

      const today = new Date();
      const startDate = format(subDays(today, 1), "yyyy-MM-dd");
      const endDate = format(addDays(today, 3), "yyyy-MM-dd");
      const todayStr = format(today, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("production_tasks")
        .select("id, title, task_date, shift, status, priority")
        .eq("hotel_id", hotelId)
        .eq("assigned_to", user.id)
        .in("status", ["pending", "in_progress"])
        .gte("task_date", startDate)
        .lte("task_date", endDate)
        .order("task_date", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((task) => {
        const isOverdue = task.task_date < todayStr && task.status !== "completed";
        const level = isOverdue ? "critical" : mapPriorityToLevel(task.priority);
        const dateLabel = isOverdue ? "vencida" : task.task_date === todayStr ? "hoy" : task.task_date;

        return {
          id: task.id,
          level,
          title: task.title,
          detail: `${dateLabel} - ${task.shift === "morning" ? "Manana" : task.shift === "afternoon" ? "Tarde" : "Noche"}`,
          ctaTo: "/my-shift",
        } satisfies PriorityNotification;
      });
    },
  });
}
