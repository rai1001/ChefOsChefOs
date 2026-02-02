import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export interface Staff {
  id: string;
  hotel_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffInsert {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  notes?: string | null;
}

export function useStaff() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["staff", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("full_name");

      if (error) throw error;
      return data as Staff[];
    },
    enabled: !!hotelId,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (staff: StaffInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("staff")
        .insert({ ...staff, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({
        title: "Personal agregado",
        description: "Se ha añadido el empleado correctamente",
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

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Staff> & { id: string }) => {
      const { data, error } = await supabase
        .from("staff")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({
        title: "Personal actualizado",
        description: "Los cambios se han guardado",
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

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast({
        title: "Personal eliminado",
        description: "El empleado ha sido eliminado",
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
