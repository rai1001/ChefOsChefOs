import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface AlertSubscription {
  id: string;
  hotel_id: string;
  user_id: string;
  channel: "email";
  frequency: "daily" | "weekly";
  enabled: boolean;
  send_at: string;
  weekday: number | null;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useAlertSubscriptions() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["alert_subscriptions", hotelId, user?.id],
    queryFn: async () => {
      if (!hotelId || !user?.id) return [] as AlertSubscription[];
      const { data, error } = await supabaseUntyped
        .from("alert_subscriptions")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("user_id", user.id)
        .order("frequency");
      if (error) throw error;
      return data as AlertSubscription[];
    },
    enabled: !!hotelId && !!user?.id,
  });
}

export function useUpsertAlertSubscription() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      frequency: "daily" | "weekly";
      enabled: boolean;
      sendAt?: string;
      weekday?: number | null;
    }) => {
      if (!hotelId || !user?.id) throw new Error("No hay hotel o usuario");
      const { error } = await supabaseUntyped.from("alert_subscriptions").upsert(
        {
          hotel_id: hotelId,
          user_id: user.id,
          channel: "email",
          frequency: payload.frequency,
          enabled: payload.enabled,
          send_at: payload.sendAt ?? "07:00",
          weekday: payload.weekday ?? null,
        },
        { onConflict: "hotel_id,user_id,channel,frequency" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert_subscriptions"] });
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
