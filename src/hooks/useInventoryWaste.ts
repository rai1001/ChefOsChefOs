import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpsTelemetry } from "@/hooks/useOpsTelemetry";

export interface InventoryWasteRecord {
  id: string;
  hotel_id: string;
  lot_id: string | null;
  product_id: string;
  qty: number;
  cause: string;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
  product?: { id: string; name: string } | null;
}

export const WASTE_CAUSES = [
  { value: "expired", label: "Caducado" },
  { value: "damage", label: "Daño" },
  { value: "spoilage", label: "Deterioro" },
  { value: "overproduction", label: "Sobreproducción" },
  { value: "handling", label: "Manipulación" },
  { value: "other", label: "Otro" },
] as const;

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useInventoryWaste() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["inventory_waste", hotelId],
    queryFn: async () => {
      if (!hotelId) return [] as InventoryWasteRecord[];
      const { data, error } = await supabaseUntyped
        .from("inventory_waste")
        .select(`
          *,
          product:products(id, name)
        `)
        .eq("hotel_id", hotelId)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as InventoryWasteRecord[];
    },
    enabled: !!hotelId,
  });
}

export function useCreateInventoryWaste() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async (payload: {
      lot_id?: string | null;
      product_id: string;
      qty: number;
      cause: string;
      note?: string | null;
    }) => {
      if (!hotelId || !user?.id) throw new Error("No hay hotel seleccionado");

      const { data, error } = await supabaseUntyped
        .from("inventory_waste")
        .insert({
          hotel_id: hotelId,
          lot_id: payload.lot_id ?? null,
          product_id: payload.product_id,
          qty: payload.qty,
          cause: payload.cause,
          note: payload.note ?? null,
          recorded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await logEvent({
        entity: "inventory_waste",
        action: "create",
        payload: { waste_id: data.id, product_id: payload.product_id, qty: payload.qty, cause: payload.cause },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_waste"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_lots"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stats"] });
      toast({ title: "Merma registrada" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}
