import { useQuery } from "@tanstack/react-query";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import { buildDailyPlan, PlannerEvent, PlannerTask, ShiftType } from "@/lib/dailyPlanner";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export function useDailyPlan(date: string) {
  const hotelId = useCurrentHotelId();
  const { data: featureFlags } = useFeatureFlags();

  return useQuery({
    queryKey: ["daily_plan", hotelId, date, featureFlags?.ai_daily_briefing ?? false],
    queryFn: async () => {
      if (!hotelId) return { plan: { tasks: [], unplannedTaskIds: [] }, aiBriefing: null as string | null };

      const [tasksResult, eventsResult, shiftsResult] = await Promise.all([
        supabase
          .from("production_tasks")
          .select("id, title, shift, priority, status")
          .eq("hotel_id", hotelId)
          .eq("task_date", date)
          .in("status", ["pending", "in_progress"]),
        supabase
          .from("events")
          .select("id, name, pax")
          .eq("hotel_id", hotelId)
          .eq("event_date", date),
        supabase
          .from("staff_shift_assignments")
          .select("staff_id, shift_type")
          .eq("hotel_id", hotelId)
          .eq("shift_date", date)
          .neq("shift_type", "off"),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (shiftsResult.error) throw shiftsResult.error;

      const tasks: PlannerTask[] = (tasksResult.data ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        shift: (task.shift as ShiftType) ?? "morning",
        priority: (task.priority as "high" | "medium" | "low") ?? "medium",
        durationMinutes: 60,
        serviceWindow: "pre_service",
      }));

      const events: PlannerEvent[] = (eventsResult.data ?? []).map((event) => ({
        id: event.id,
        name: event.name,
        pax: event.pax ?? 0,
        shift: "afternoon",
      }));

      const capacities = (shiftsResult.data ?? []).map((assignment) => ({
        staffId: assignment.staff_id,
        shift: assignment.shift_type as ShiftType,
        capacityMinutes: 240,
      }));

      const plan = buildDailyPlan({ tasks, events, capacities });
      let aiBriefing: string | null = null;

      if (featureFlags?.ai_daily_briefing) {
        const { data: aiData, error: aiError } = await supabase.functions.invoke(
          "daily-ops-briefing",
          {
            body: {
              date,
              plannedTaskCount: plan.tasks.length,
              unplannedTaskCount: plan.unplannedTaskIds.length,
              eventsCount: events.length,
            },
          },
        );

        if (!aiError && aiData?.briefing) {
          aiBriefing = aiData.briefing;
        }
      }

      return {
        plan,
        aiBriefing,
      };
    },
    enabled: !!hotelId && !!date,
  });
}
