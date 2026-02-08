import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rankHotelBenchmarks } from "@/lib/superAdminBenchmarks";

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useSuperAdminAnalytics() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return useQuery({
    queryKey: ["superadmin_benchmarks"],
    queryFn: async () => {
      const { data, error } = await supabaseUntyped
        .from("superadmin_hotel_benchmarks")
        .select("*");
      if (error) throw error;
      return rankHotelBenchmarks(data ?? []);
    },
    enabled: isSuperAdmin,
  });
}
