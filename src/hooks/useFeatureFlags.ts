import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_FEATURE_FLAGS,
  FeatureFlagKey,
  HotelFeatureFlags,
  normalizeFeatureFlags,
} from "@/lib/featureFlags";

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useFeatureFlags() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["feature_flags", hotelId],
    queryFn: async (): Promise<HotelFeatureFlags> => {
      if (!hotelId) return DEFAULT_FEATURE_FLAGS;
      const { data, error } = await supabaseUntyped
        .from("hotel_feature_flags")
        .select("feature_key, enabled")
        .eq("hotel_id", hotelId);
      if (error) throw error;
      return normalizeFeatureFlags(data);
    },
    enabled: !!hotelId,
  });
}

export function useSetFeatureFlag() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      key,
      enabled,
    }: {
      key: FeatureFlagKey;
      enabled: boolean;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { error } = await supabaseUntyped
        .from("hotel_feature_flags")
        .upsert(
          {
            hotel_id: hotelId,
            feature_key: key,
            enabled,
            updated_by: user?.id ?? null,
          },
          { onConflict: "hotel_id,feature_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature_flags"] });
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
