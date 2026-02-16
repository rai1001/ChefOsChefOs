import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import type { StaffShiftAssignment } from "@/hooks/useStaffShiftAssignments";

interface LinkedStaffProfile {
  id: string;
  full_name: string;
  role: string;
}

export interface MyShiftSnapshot {
  linkedStaff: LinkedStaffProfile | null;
  todayShift: StaffShiftAssignment | null;
  upcomingShifts: StaffShiftAssignment[];
}

export function useMyShiftSnapshot(options?: { days?: number }) {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const days = options?.days ?? 7;

  return useQuery({
    queryKey: ["my-shift-snapshot", hotelId, user?.id, days],
    enabled: !!hotelId && !!user?.id,
    queryFn: async (): Promise<MyShiftSnapshot> => {
      if (!hotelId || !user?.id) {
        return {
          linkedStaff: null,
          todayShift: null,
          upcomingShifts: [],
        };
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), days), "yyyy-MM-dd");

      const { data: linkedStaff, error: linkedStaffError } = await supabase
        .from("staff")
        .select("id, full_name, role")
        .eq("hotel_id", hotelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (linkedStaffError) throw linkedStaffError;
      if (!linkedStaff) {
        return {
          linkedStaff: null,
          todayShift: null,
          upcomingShifts: [],
        };
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from("staff_shift_assignments")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("staff_id", linkedStaff.id)
        .gte("shift_date", today)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const rows = (assignments ?? []) as StaffShiftAssignment[];

      return {
        linkedStaff,
        todayShift: rows.find((row) => row.shift_date === today) ?? null,
        upcomingShifts: rows,
      };
    },
  });
}
