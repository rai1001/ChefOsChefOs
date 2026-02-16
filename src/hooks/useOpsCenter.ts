import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  buildWatchdogSummary,
  type OpsServiceHeartbeat,
  type OpsServiceKey,
  type OpsServiceStatus,
} from "@/lib/opsWatchdog";

const supabaseUntyped = supabase as unknown as SupabaseClient;

export interface OpsIncident {
  id: string;
  hotel_id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "mitigated" | "resolved";
  source: "system" | "sync" | "jobs" | "backup" | "manual";
  summary: string | null;
  runbook_slug: string | null;
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  acknowledged_by: string | null;
  resolved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsIncidentEvent {
  id: string;
  incident_id: string;
  hotel_id: string;
  event_type:
    | "opened"
    | "acknowledged"
    | "comment"
    | "status_changed"
    | "resolved"
    | "runbook_linked"
    | "watchdog_triggered";
  note: string | null;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

export interface OpsRunbook {
  id: string;
  hotel_id: string;
  slug: string;
  title: string;
  category: "system" | "sync" | "jobs" | "backup" | "inventory" | "purchases" | "tasks" | "other";
  trigger_pattern: string | null;
  steps: string[];
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useOpsCenterMonitoring() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-center-monitoring", hotelId],
    enabled: !!hotelId,
    refetchInterval: 30_000,
    staleTime: 10_000,
    queryFn: async () => {
      if (!hotelId) {
        return {
          heartbeats: [] as OpsServiceHeartbeat[],
          openIncidents: [] as OpsIncident[],
          summary: buildWatchdogSummary([]),
        };
      }

      const sinceIso = new Date(Date.now() - 24 * 60 * 60000).toISOString();

      const [heartbeatsResult, incidentsResult] = await Promise.all([
        supabaseUntyped
          .from("ops_service_heartbeats")
          .select("id, service_key, status, latency_ms, queue_depth, detail, observed_at")
          .eq("hotel_id", hotelId)
          .gte("observed_at", sinceIso)
          .order("observed_at", { ascending: false })
          .limit(500),
        supabaseUntyped
          .from("ops_incidents")
          .select("*")
          .eq("hotel_id", hotelId)
          .neq("status", "resolved")
          .order("opened_at", { ascending: false })
          .limit(100),
      ]);

      if (heartbeatsResult.error) throw heartbeatsResult.error;
      if (incidentsResult.error) throw incidentsResult.error;

      const heartbeats = (heartbeatsResult.data ?? []) as OpsServiceHeartbeat[];
      const openIncidents = (incidentsResult.data ?? []) as OpsIncident[];

      return {
        heartbeats,
        openIncidents,
        summary: buildWatchdogSummary(heartbeats),
      };
    },
  });
}

export function useOpsIncidents(options?: { includeResolved?: boolean }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-incidents", hotelId, options?.includeResolved ?? true],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [] as OpsIncident[];

      let query = supabaseUntyped
        .from("ops_incidents")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("opened_at", { ascending: false })
        .limit(200);

      if (!options?.includeResolved) {
        query = query.neq("status", "resolved");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OpsIncident[];
    },
  });
}

export function useOpsIncidentEvents(incidentId: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-incident-events", hotelId, incidentId],
    enabled: !!hotelId && !!incidentId,
    queryFn: async () => {
      if (!hotelId || !incidentId) return [] as OpsIncidentEvent[];

      const { data, error } = await supabaseUntyped
        .from("ops_incident_events")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as OpsIncidentEvent[];
    },
  });
}

export function useOpsRunbooks() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-runbooks", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [] as OpsRunbook[];

      const { data, error } = await supabaseUntyped
        .from("ops_runbooks")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("active", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as Array<Omit<OpsRunbook, "steps"> & { steps: unknown }>).map((item) => ({
        ...item,
        steps: Array.isArray(item.steps)
          ? item.steps.filter((step): step is string => typeof step === "string")
          : [],
      }));
    },
  });
}

export function useCreateOpsIncident() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      severity: OpsIncident["severity"];
      source: OpsIncident["source"];
      summary?: string;
      runbookSlug?: string;
      openedAt?: string;
      asWatchdog?: boolean;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const openedAt = payload.openedAt ?? new Date().toISOString();
      const { data: incident, error: incidentError } = await supabaseUntyped
        .from("ops_incidents")
        .insert({
          hotel_id: hotelId,
          title: payload.title,
          severity: payload.severity,
          source: payload.source,
          summary: payload.summary ?? null,
          runbook_slug: payload.runbookSlug ?? null,
          opened_at: openedAt,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();

      if (incidentError) throw incidentError;

      const { error: timelineError } = await supabaseUntyped.from("ops_incident_events").insert({
        incident_id: incident.id,
        hotel_id: hotelId,
        event_type: payload.asWatchdog ? "watchdog_triggered" : "opened",
        note: payload.summary ?? "Incidente abierto",
        payload: {
          severity: payload.severity,
          source: payload.source,
          runbook_slug: payload.runbookSlug ?? null,
        },
        actor_user_id: user?.id ?? null,
      });

      if (timelineError) throw timelineError;

      return incident as OpsIncident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-center-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["ops-incidents"] });
      toast({
        title: "Incidente creado",
        description: "Se registro el incidente y su timeline inicial.",
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

export function useUpdateOpsIncidentStatus() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      incidentId: string;
      status: OpsIncident["status"];
      note?: string;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const nowIso = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status: payload.status,
      };

      if (payload.status === "investigating") {
        updates.acknowledged_at = nowIso;
        updates.acknowledged_by = user?.id ?? null;
      }

      if (payload.status === "resolved") {
        updates.resolved_at = nowIso;
        updates.resolved_by = user?.id ?? null;
      }

      const { error: updateError } = await supabaseUntyped
        .from("ops_incidents")
        .update(updates)
        .eq("hotel_id", hotelId)
        .eq("id", payload.incidentId);

      if (updateError) throw updateError;

      const eventType: OpsIncidentEvent["event_type"] =
        payload.status === "resolved"
          ? "resolved"
          : payload.status === "investigating"
            ? "acknowledged"
            : "status_changed";

      const { error: timelineError } = await supabaseUntyped.from("ops_incident_events").insert({
        incident_id: payload.incidentId,
        hotel_id: hotelId,
        event_type: eventType,
        note: payload.note ?? `Estado actualizado a ${payload.status}`,
        payload: { status: payload.status },
        actor_user_id: user?.id ?? null,
      });

      if (timelineError) throw timelineError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-center-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["ops-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["ops-incident-events"] });
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

export function useAddOpsIncidentNote() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { incidentId: string; note: string }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const note = payload.note.trim();
      if (!note) throw new Error("La nota no puede estar vacia");

      const { error } = await supabaseUntyped.from("ops_incident_events").insert({
        incident_id: payload.incidentId,
        hotel_id: hotelId,
        event_type: "comment",
        note,
        payload: {},
        actor_user_id: user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-incident-events"] });
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

export function useCreateServiceHeartbeat() {
  const hotelId = useCurrentHotelId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      serviceKey: OpsServiceKey;
      status: OpsServiceStatus;
      latencyMs?: number | null;
      queueDepth?: number | null;
      detail?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { error } = await supabaseUntyped.from("ops_service_heartbeats").insert({
        hotel_id: hotelId,
        service_key: payload.serviceKey,
        status: payload.status,
        latency_ms: payload.latencyMs ?? null,
        queue_depth: payload.queueDepth ?? 0,
        detail: payload.detail ?? null,
        metadata: payload.metadata ?? {},
        created_by: user?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-center-monitoring"] });
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

export function useDispatchOpsAlert() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("send-ops-alert", {
        body: { source: "operations_center", at: new Date().toISOString() },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Alerta enviada",
        description: "Se ejecuto el despacho de alertas operativas.",
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

export function useOpsHeartbeatReporter() {
  const hotelId = useCurrentHotelId();
  const { roles } = useAuth();
  const heartbeat = useCreateServiceHeartbeat();

  useEffect(() => {
    if (!hotelId) return;

    const canReport =
      roles.includes("admin") ||
      roles.includes("jefe_cocina") ||
      roles.includes("super_admin");
    if (!canReport) return;

    const key = `ops-heartbeat:web_app:${hotelId}`;
    const now = Date.now();
    const last = Number(window.localStorage.getItem(key) ?? "0");

    if (now - last < 5 * 60_000) return;

    window.localStorage.setItem(key, String(now));
    heartbeat.mutate({
      serviceKey: "web_app",
      status: "ok",
      latencyMs: null,
      queueDepth: 0,
      detail: "Heartbeat automatico cliente web",
      metadata: { source: "main_layout", ts: new Date(now).toISOString() },
    });
  }, [heartbeat, hotelId, roles]);
}
