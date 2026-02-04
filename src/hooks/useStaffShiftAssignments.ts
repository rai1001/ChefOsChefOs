import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export type StaffShiftType = "morning" | "afternoon" | "night" | "off";

export interface StaffShiftAssignment {
  id: string;
  hotel_id: string;
  staff_id: string;
  shift_date: string;
  shift_type: StaffShiftType;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffShiftAssignmentUpsert {
  staff_id: string;
  shift_date: string; // yyyy-MM-dd
  shift_type: StaffShiftType;
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  notes?: string | null;
}

export function useStaffShiftAssignments(options: { startDate: string; endDate: string }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["staff-shift-assignments", hotelId, options.startDate, options.endDate],
    queryFn: async () => {
      if (!hotelId) return [];

      const { data, error } = await supabase
        .from("staff_shift_assignments")
        .select("*")
        .eq("hotel_id", hotelId)
        .gte("shift_date", options.startDate)
        .lte("shift_date", options.endDate)
        .order("shift_date", { ascending: true });

      if (error) throw error;
      return (data || []) as StaffShiftAssignment[];
    },
    enabled: !!hotelId && !!options.startDate && !!options.endDate,
  });
}

export function useUpsertStaffShiftAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (assignment: StaffShiftAssignmentUpsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const payload = {
        hotel_id: hotelId,
        staff_id: assignment.staff_id,
        shift_date: assignment.shift_date,
        shift_type: assignment.shift_type,
        start_time: assignment.start_time ?? null,
        end_time: assignment.end_time ?? null,
        notes: assignment.notes ?? null,
      };

      const { data, error } = await supabase
        .from("staff_shift_assignments")
        .upsert(payload, { onConflict: "staff_id,shift_date" })
        .select()
        .single();

      if (error) throw error;
      return data as StaffShiftAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-shift-assignments"] });
      toast({
        title: "Turno guardado",
        description: "El turno se ha actualizado correctamente",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useDeleteStaffShiftAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async ({ staffId, shiftDate }: { staffId: string; shiftDate: string }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { error } = await supabase
        .from("staff_shift_assignments")
        .delete()
        .eq("hotel_id", hotelId)
        .eq("staff_id", staffId)
        .eq("shift_date", shiftDate);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-shift-assignments"] });
      toast({
        title: "Turno eliminado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

