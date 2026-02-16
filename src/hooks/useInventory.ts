import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { addDays, format } from "date-fns";
import { useOpsTelemetry } from "@/hooks/useOpsTelemetry";

export interface InventoryLot {
  id: string;
  product_id: string;
  quantity: number;
  lot_number: string | null;
  expiry_date: string | null;
  entry_date: string;
  location: string | null;
  cost_per_unit: number | null;
  supplier_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  barcode: string | null;
  movement_type: string | null;
  reference_document: string | null;
}

export interface InventoryLotWithRelations extends InventoryLot {
  product?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}

export interface InventoryLotInsert {
  product_id: string;
  quantity: number;
  lot_number?: string | null;
  expiry_date?: string | null;
  entry_date?: string;
  location?: string | null;
  cost_per_unit?: number | null;
  supplier_id?: string | null;
  notes?: string | null;
  barcode?: string | null;
  reference_document?: string | null;
}

export function useInventoryLots(options?: { expiringWithinDays?: number }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["inventory_lots", hotelId, options?.expiringWithinDays],
    queryFn: async () => {
      if (!hotelId) return [] as InventoryLotWithRelations[];

      let query = supabase
        .from("inventory_lots")
        .select(`
          *,
          product:products(id, name),
          supplier:suppliers(id, name)
        `)
        .eq("hotel_id", hotelId)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true });

      if (options?.expiringWithinDays) {
        const limitDate = format(addDays(new Date(), options.expiringWithinDays), "yyyy-MM-dd");
        query = query.lte("expiry_date", limitDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryLotWithRelations[];
    },
    enabled: !!hotelId,
  });
}

export function useExpiringLots(days: number = 7) {
  const hotelId = useCurrentHotelId();
  const today = format(new Date(), "yyyy-MM-dd");
  const limitDate = format(addDays(new Date(), days), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["inventory_lots", hotelId, "expiring", days],
    queryFn: async () => {
      if (!hotelId) return [] as InventoryLotWithRelations[];
      const { data, error } = await supabase
        .from("inventory_lots")
        .select(`
          *,
          product:products(id, name),
          supplier:suppliers(id, name)
        `)
        .eq("hotel_id", hotelId)
        .gt("quantity", 0)
        .gte("expiry_date", today)
        .lte("expiry_date", limitDate)
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data as InventoryLotWithRelations[];
    },
    enabled: !!hotelId,
  });
}

export function useInventoryStats() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["inventory_stats", hotelId],
    queryFn: async () => {
      if (!hotelId) {
        return {
          totalLots: 0,
          criticalCount: 0,
          expiringCount: 0,
          expiring14Count: 0,
          uniqueLocations: 0,
        };
      }

      const threeDaysLater = format(addDays(new Date(), 3), "yyyy-MM-dd");
      const sevenDaysLater = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const fourteenDaysLater = format(addDays(new Date(), 14), "yyyy-MM-dd");

      // Get all lots with quantity > 0
      const { data: lots, error } = await supabase
        .from("inventory_lots")
        .select("id, expiry_date, location")
        .eq("hotel_id", hotelId)
        .gt("quantity", 0);

      if (error) throw error;

      const totalLots = lots?.length || 0;
      const criticalCount = lots?.filter(l => 
        l.expiry_date && l.expiry_date <= threeDaysLater
      ).length || 0;
      const expiringCount = lots?.filter(l => 
        l.expiry_date && l.expiry_date > threeDaysLater && l.expiry_date <= sevenDaysLater
      ).length || 0;
      const expiring14Count = lots?.filter(l =>
        l.expiry_date && l.expiry_date > sevenDaysLater && l.expiry_date <= fourteenDaysLater
      ).length || 0;
      const uniqueLocations = new Set(lots?.map(l => l.location).filter(Boolean)).size;

      return {
        totalLots,
        criticalCount,
        expiringCount,
        expiring14Count,
        uniqueLocations,
      };
    },
    enabled: !!hotelId,
  });
}

export function useCreateInventoryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async (lot: InventoryLotInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("inventory_lots")
        .insert({ ...lot, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      await logEvent({
        entity: "inventory_lot",
        action: "create",
        payload: { lot_id: data.id, product_id: data.product_id, qty: data.quantity },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_lots"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Lote registrado",
        description: "El lote se ha añadido al inventario",
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

export function useUpdateInventoryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryLot> & { id: string }) => {
      const { data, error } = await supabase
        .from("inventory_lots")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      await logEvent({
        entity: "inventory_lot",
        action: "update",
        payload: { lot_id: id, updates },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_lots"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stats"] });
      toast({
        title: "Lote actualizado",
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

export function useDeleteInventoryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventory_lots")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await logEvent({
        entity: "inventory_lot",
        action: "delete",
        payload: { lot_id: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_lots"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Lote eliminado",
        description: "El lote se ha eliminado del inventario",
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
