import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useOpsTelemetry } from "@/hooks/useOpsTelemetry";
import { resolveApprovalRequirement } from "@/lib/approvalRules";

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

interface ApprovalPolicyRow {
  threshold_amount: number | null;
  required_role: string;
  active: boolean | null;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function usePurchases(options?: { status?: string }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["purchases", hotelId, options?.status],
    queryFn: async () => {
      if (!hotelId) return [] as PurchaseWithRelations[];

      let query = supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name, delivery_days, delivery_lead_days)
        `)
        .eq("hotel_id", hotelId)
        .order("order_date", { ascending: false });

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseWithRelations[];
    },
    enabled: !!hotelId,
  });
}

// Get pending deliveries for alerts
export function usePendingDeliveries() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["pending_deliveries", hotelId],
    queryFn: async () => {
      if (!hotelId) {
        return { late: [], today: [], upcoming: [], all: [] as PurchaseWithRelations[] };
      }

      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name, delivery_days, delivery_lead_days)
        `)
        .eq("hotel_id", hotelId)
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
    enabled: !!hotelId,
  });
}

// Get incomplete deliveries
export function useIncompleteDeliveries() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["incomplete_deliveries", hotelId],
    queryFn: async () => {
      if (!hotelId) return [] as PurchaseWithRelations[];

      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(id, name)
        `)
        .eq("hotel_id", hotelId)
        .eq("is_complete", false)
        .not("received_at", "is", null)
        .order("received_at", { ascending: false });

      if (error) throw error;
      return data as PurchaseWithRelations[];
    },
    enabled: !!hotelId,
  });
}

export function usePurchase(id: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["purchase", hotelId, id],
    enabled: !!id && !!hotelId,
    queryFn: async () => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
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
        .eq("hotel_id", hotelId)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as PurchaseWithRelations;
    },
  });
}

export function usePurchaseStats() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["purchase_stats", hotelId],
    queryFn: async () => {
      if (!hotelId) {
        return {
          draftCount: 0,
          pendingCount: 0,
          orderedCount: 0,
          totalAmount: 0,
        };
      }

      const { data: purchases, error } = await supabase
        .from("purchases")
        .select("id, status, total_amount")
        .eq("hotel_id", hotelId);
      
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
    enabled: !!hotelId,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async (purchase: PurchaseInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("purchases")
        .insert({ ...purchase, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      await logEvent({
        entity: "purchase",
        action: "create",
        payload: { purchase_id: data.id, supplier_id: data.supplier_id },
      });
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
  const hotelId = useCurrentHotelId();
  const { logEvent } = useOpsTelemetry();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Purchase> & { id: string }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      if (updates.status === "ordered") {
        const amountFromInput = updates.total_amount ?? null;
        let amount = amountFromInput;

        if (amount == null) {
          const { data: purchaseAmount, error: amountError } = await supabase
            .from("purchases")
            .select("total_amount")
            .eq("id", id)
            .maybeSingle();
          if (amountError) throw amountError;
          amount = purchaseAmount?.total_amount ?? 0;
        }

        const { data: policies, error: policyError } = await supabaseUntyped
          .from("approval_policies")
          .select("entity, threshold_amount, required_role, active")
          .eq("hotel_id", hotelId)
          .eq("entity", "purchase")
          .eq("active", true);

        if (policyError) throw policyError;

        const policyRows = (policies ?? []) as ApprovalPolicyRow[];
        const decision = resolveApprovalRequirement(
          policyRows.map((policy) => ({
            entity: "purchase",
            thresholdAmount: policy.threshold_amount,
            requiredRole: policy.required_role,
            active: policy.active,
          })),
          "purchase",
          amount ?? 0,
        );

        if (decision.requiresApproval) {
          const { error: approvalError } = await supabaseUntyped.rpc("create_approval_request", {
            _hotel_id: hotelId,
            _entity: "purchase",
            _entity_id: id,
            _amount: amount ?? 0,
            _payload: {
              id,
              updates,
              trigger: "purchase_ordered",
            },
          });
          if (approvalError) throw approvalError;

          const { data: gatedData, error: gatedUpdateError } = await supabase
            .from("purchases")
            .update({
              ...updates,
              status: "pending_approval",
            })
            .eq("id", id)
            .select()
            .single();
          if (gatedUpdateError) throw gatedUpdateError;

          await logEvent({
            entity: "approval_request",
            action: "purchase_ordered_requires_approval",
            payload: { purchase_id: id, amount: amount ?? 0, required_role: decision.requiredRole },
          });

          return gatedData;
        }
      }

      const { data, error } = await supabase
        .from("purchases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      await logEvent({
        entity: "purchase",
        action: "update",
        payload: { purchase_id: id, updates },
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_stats"] });
      toast({
        title: data?.status === "pending_approval" ? "Aprobación solicitada" : "Pedido actualizado",
        description:
          data?.status === "pending_approval"
            ? "El pedido quedó pendiente de aprobación."
            : "Los cambios se han guardado",
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
  const { logEvent } = useOpsTelemetry();

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

      await logEvent({
        entity: "purchase",
        action: "delete",
        payload: { purchase_id: id },
      });
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
  const { logEvent } = useOpsTelemetry();

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

      await logEvent({
        entity: "purchase",
        action: "receive",
        payload: {
          purchase_id: id,
          is_complete,
          has_issues: !!delivery_issues,
        },
      });
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
