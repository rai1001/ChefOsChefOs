import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ApprovalRequest {
  id: string;
  hotel_id: string;
  entity: "purchase" | "menu";
  entity_id: string | null;
  required_role: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  amount: number | null;
  payload: Record<string, unknown>;
  requested_at: string;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useApprovals(status: ApprovalRequest["status"] | "all" = "pending") {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["approval_requests", hotelId, status],
    queryFn: async () => {
      if (!hotelId) return [] as ApprovalRequest[];
      let query = supabaseUntyped
        .from("approval_requests")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("requested_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as ApprovalRequest[];
    },
    enabled: !!hotelId,
  });
}

export function useResolveApproval() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status: "approved" | "rejected" | "cancelled";
      note?: string;
    }) => {
      if (!hotelId || !user?.id) throw new Error("No hay hotel seleccionado");

      const { error: updateError } = await supabaseUntyped
        .from("approval_requests")
        .update({
          status: payload.status,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", payload.id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabaseUntyped.from("approval_events").insert({
        request_id: payload.id,
        hotel_id: hotelId,
        actor_user_id: user.id,
        action: payload.status === "approved" ? "approved" : payload.status === "rejected" ? "rejected" : "cancelled",
        note: payload.note ?? null,
      });
      if (eventError) throw eventError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval_requests"] });
      toast({ title: "Aprobación actualizada" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}
