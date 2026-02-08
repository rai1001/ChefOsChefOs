import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface AgentConnection {
  id: string;
  hotel_id: string;
  agent_name: string;
  agent_id: string;
  public_key: string;
  status: "active" | "inactive" | "revoked";
  allowed_scopes: string[];
  created_at: string;
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

export function useAgentConnections() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["agent_connections", hotelId],
    queryFn: async () => {
      if (!hotelId) return [] as AgentConnection[];
      const { data, error } = await supabaseUntyped
        .from("agent_connections")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AgentConnection[];
    },
    enabled: !!hotelId,
  });
}

export function useCreateAgentConnection() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      agent_name: string;
      agent_id: string;
      public_key: string;
      allowed_scopes: string[];
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      const { error } = await supabaseUntyped.from("agent_connections").insert({
        hotel_id: hotelId,
        agent_name: payload.agent_name,
        agent_id: payload.agent_id,
        public_key: payload.public_key,
        allowed_scopes: payload.allowed_scopes,
        status: "active",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_connections"] });
      toast({ title: "Conexión creada", description: "La conexión del agente quedó registrada." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useUpdateAgentConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status?: "active" | "inactive" | "revoked";
      allowed_scopes?: string[];
      public_key?: string;
    }) => {
      const { id, ...updates } = payload;
      const { error } = await supabaseUntyped
        .from("agent_connections")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_connections"] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useDeleteAgentConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseUntyped.from("agent_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_connections"] });
      toast({ title: "Conexión eliminada" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}
