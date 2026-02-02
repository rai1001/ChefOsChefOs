import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export interface Purchase {
  id: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  status: string | null;
  total_amount: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // New tracking fields
  received_at: string | null;
  delivery_status: string | null;
  is_complete: boolean | null;
  delivery_issues: string | null;
  delivery_note_url: string | null;
}

export interface PurchaseWithRelations extends Purchase {
  supplier?: { 
    id: string; 
    name: string;
    delivery_days?: string[] | null;
    delivery_lead_days?: number | null;
  } | null;
  items?: PurchaseItemWithProduct[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  received_quantity: number | null;
  created_at: string;
}

export interface PurchaseItemWithProduct extends PurchaseItem {
  product?: { id: string; name: string } | null;
}

export interface PurchaseInsert {
  supplier_id: string;
  order_date?: string;
  expected_date?: string | null;
  status?: string;
  notes?: string | null;
}

export interface PurchaseItemInsert {
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_price?: number | null;
}

export function usePurchases(options?: { status?: string }) {
  return useQuery({
    queryKey: ["purchases", options?.status],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name, delivery_days, delivery_lead_days)
        `)
        .order("order_date", { ascending: false });

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseWithRelations[];
    },
  });
}

// Get pending deliveries for alerts
export function usePendingDeliveries() {
  return useQuery({
    queryKey: ["pending_deliveries"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name, delivery_days, delivery_lead_days)
        `)
        .eq("status", "ordered")
        .order("expected_date", { ascending: true });

      if (error) throw error;
      
      // Categorize deliveries
      const purchases = data as PurchaseWithRelations[];
      const late: PurchaseWithRelations[] = [];
      const today_expected: PurchaseWithRelations[] = [];
      const upcoming: PurchaseWithRelations[] = [];

      for (const p of purchases) {
        if (p.expected_date) {
          if (p.expected_date < today) {
            late.push(p);
          } else if (p.expected_date === today) {
            today_expected.push(p);
          } else {
            upcoming.push(p);
          }
        } else {
          upcoming.push(p);
        }
      }

      return { late, today: today_expected, upcoming, all: purchases };
    },
  });
}

// Get incomplete deliveries
export function useIncompleteDeliveries() {
  return useQuery({
    queryKey: ["incomplete_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name)
        `)
        .eq("is_complete", false)
        .not("received_at", "is", null)
        .order("received_at", { ascending: false });

      if (error) throw error;
      return data as PurchaseWithRelations[];
    },
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: ["purchase", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name),
          items:purchase_items(
            *,
            product:products(id, name)
          )
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as PurchaseWithRelations;
    },
  });
}

export function usePurchaseStats() {
  return useQuery({
    queryKey: ["purchase_stats"],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from("purchases")
        .select("id, status, total_amount");

      if (error) throw error;

      const draftCount = purchases?.filter(p => p.status === "draft").length || 0;
      const pendingCount = purchases?.filter(p => p.status === "pending").length || 0;
      const orderedCount = purchases?.filter(p => p.status === "ordered").length || 0;
      const totalAmount = purchases
        ?.filter(p => p.status === "ordered" || p.status === "received")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;

      return {
        draftCount,
        pendingCount,
        orderedCount,
        totalAmount,
      };
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (purchase: PurchaseInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("purchases")
        .insert({ ...purchase, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
      toast({
        title: "Pedido creado",
        description: "El pedido se ha creado correctamente",
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

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Purchase> & { id: string }) => {
      const { data, error } = await supabase
        .from("purchases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
      toast({
        title: "Pedido actualizado",
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

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete items
      const { error: itemsError } = await supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", id);

      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
      toast({
        title: "Pedido eliminado",
        description: "El pedido se ha eliminado",
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

export function useAddPurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: PurchaseItemInsert) => {
      const { data, error } = await supabase
        .from("purchase_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase", variables.purchase_id] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useUpdatePurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PurchaseItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("purchase_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useDeletePurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useUpdatePurchaseTotal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseId: string) => {
      // Calculate total from items
      const { data: items, error: itemsError } = await supabase
        .from("purchase_items")
        .select("quantity, unit_price")
        .eq("purchase_id", purchaseId);

      if (itemsError) throw itemsError;

      const total = items?.reduce((sum, item) => 
        sum + (item.quantity * (item.unit_price || 0)), 0
      ) || 0;

      const { data, error } = await supabase
        .from("purchases")
        .update({ total_amount: total })
        .eq("id", purchaseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
    },
  });
}

// Receive a purchase order
export function useReceivePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      is_complete,
      delivery_issues,
      delivery_note_url,
    }: {
      id: string;
      is_complete: boolean;
      delivery_issues?: string;
      delivery_note_url?: string;
    }) => {
      const { data, error } = await supabase
        .from("purchases")
        .update({
          status: "received",
          received_at: new Date().toISOString(),
          delivery_status: is_complete ? "delivered" : "incomplete",
          is_complete,
          delivery_issues: delivery_issues || null,
          delivery_note_url: delivery_note_url || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending_deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["incomplete_deliveries"] });
      
      toast({
        title: variables.is_complete ? "Pedido recibido" : "Incidencia registrada",
        description: variables.is_complete 
          ? "El pedido se ha marcado como recibido" 
          : "Se ha registrado la incidencia del pedido",
        variant: variables.is_complete ? "default" : "destructive",
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
