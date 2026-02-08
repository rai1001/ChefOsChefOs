import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean | null;
  delivery_days: string[] | null;
  delivery_lead_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierInsert {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  delivery_days?: string[];
  delivery_lead_days?: number;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];

export { DAYS_OF_WEEK };

export function useSuppliersList() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["suppliers_full", hotelId],
    queryFn: async () => {
      if (!hotelId) return [] as Supplier[];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("name");

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!hotelId,
  });
}

export function useSupplier(id: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["supplier", hotelId, id],
    enabled: !!id && !!hotelId,
    queryFn: async () => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as Supplier;
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (supplier: SupplierInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...supplier, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers_full"] });
      toast({
        title: "Proveedor creado",
        description: "El proveedor se ha añadido correctamente",
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

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers_full"] });
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      toast({
        title: "Proveedor actualizado",
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

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers_full"] });
      toast({
        title: "Proveedor eliminado",
        description: "El proveedor se ha desactivado",
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

// Calculate next delivery date based on supplier's delivery days and lead time
export function calculateExpectedDelivery(
  orderDate: Date,
  deliveryDays: string[],
  leadDays: number
): Date | null {
  if (!deliveryDays || deliveryDays.length === 0) return null;

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const deliveryDayNumbers = deliveryDays.map(d => dayMap[d]).filter(d => d !== undefined);
  if (deliveryDayNumbers.length === 0) return null;

  // Start from order date + lead days
  const minDeliveryDate = new Date(orderDate);
  minDeliveryDate.setDate(minDeliveryDate.getDate() + leadDays);

  // Find the next delivery day on or after minDeliveryDate
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(minDeliveryDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dayOfWeek = checkDate.getDay();
    
    if (deliveryDayNumbers.includes(dayOfWeek)) {
      return checkDate;
    }
  }

  return null;
}
