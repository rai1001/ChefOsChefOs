import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MenuVersion {
  id: string;
  menu_id: string;
  version_number: number;
  name: string;
  description: string | null;
  type: string | null;
  cost_per_pax: number | null;
  snapshot: Record<string, unknown>;
  created_at: string;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useMenuVersions(menuId: string | null) {
  return useQuery({
    queryKey: ["menu_versions", menuId],
    queryFn: async () => {
      if (!menuId) return [] as MenuVersion[];
      const { data, error } = await supabaseUntyped
        .from("menu_versions")
        .select("*")
        .eq("menu_id", menuId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as MenuVersion[];
    },
    enabled: !!menuId,
  });
}

export function useCreateMenuVersion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (menuId: string) => {
      const { data, error } = await supabaseUntyped.rpc("snapshot_menu_version", {
        _menu_id: menuId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu_versions"] });
      toast({ title: "Versión creada" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}
