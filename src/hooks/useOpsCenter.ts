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
  auto_remediation_state: "idle" | "running" | "success" | "failed" | "cooldown";
  auto_remediation_last_at: string | null;
  escalation_state: "none" | "escalated" | "reminder" | "acknowledged";
  escalation_level: number;
  escalated_at: string | null;
  last_escalation_at: string | null;
  last_reminder_at: string | null;
  root_cause: string | null;
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
    | "watchdog_triggered"
    | "auto_remediation"
    | "auto_resolved"
    | "escalation"
    | "escalation_reminder";
  note: string | null;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  actor_type: "user" | "system" | "openclaw";
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

export interface OpsEscalation {
  id: string;
  hotel_id: string;
  incident_id: string;
  severity: OpsIncident["severity"];
  status: "active" | "resolved" | "suppressed";
  escalated_at: string;
  last_notified_at: string;
  next_reminder_at: string;
  reminder_count: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OpsAutomationRun {
  id: string;
  hotel_id: string;
  incident_id: string;
  service_key: OpsServiceKey;
  action_key: string;
  trigger_type: string;
  result_status: "success" | "failed" | "skipped";
  detail: string | null;
  duration_ms: number | null;
  retry_count: number;
  cooldown_applied: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface OpsServiceSli {
  hotel_id: string;
  service_key: OpsServiceKey;
  uptime_24h_pct: number;
  uptime_7d_pct: number;
  samples_24h: number;
  samples_7d: number;
  last_observed_at: string | null;
  max_queue_24h: number | null;
}

export interface OpsIncidentSli {
  hotel_id: string;
  mtta_minutes_30d: number;
  mttr_minutes_30d: number;
  incidents_by_severity_30d: Record<string, number>;
  open_backlog_by_age: {
    lt_30m: number;
    btw_30m_2h: number;
    btw_2h_8h: number;
    gte_8h: number;
    total_open: number;
  };
}

export interface OpsSloTarget {
  hotel_id: string;
  uptime_target_24h: number;
  uptime_target_7d: number;
  mtta_target_minutes: number;
  mttr_target_minutes: number;
  max_open_incidents_target: number;
  service_targets: Record<string, number>;
}

export interface OpsWeeklySnapshot {
  id: string;
  hotel_id: string;
  week_start: string;
  week_end: string;
  total_incidents: number;
  auto_resolved_pct: number;
  mtta_minutes: number | null;
  mttr_minutes: number | null;
  root_causes: Array<{ cause: string; count: number }>;
  generated_by: string;
  generated_at: string;
}

export interface OpsAutopilotHealth {
  hotel_id: string;
  bridge_status: "up" | "degraded" | "down";
  runs_30m: number;
  success_count_30m: number;
  failed_count_30m: number;
  skipped_count_30m: number;
  avg_duration_ms_30m: number;
  last_run_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
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

export function useOpsEscalations(options?: { onlyActive?: boolean }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-escalations", hotelId, options?.onlyActive ?? true],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [] as OpsEscalation[];

      let query = supabaseUntyped
        .from("ops_escalations")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("escalated_at", { ascending: false })
        .limit(200);

      if (options?.onlyActive ?? true) {
        query = query.eq("status", "active");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OpsEscalation[];
    },
  });
}

export function useOpsAutomationRuns(limit = 40) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-automation-runs", hotelId, limit],
    enabled: !!hotelId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!hotelId) return [] as OpsAutomationRun[];

      const { data, error } = await supabaseUntyped
        .from("ops_automation_runs")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as OpsAutomationRun[];
    },
  });
}

export function useOpsSliPanel() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-sli-panel", hotelId],
    enabled: !!hotelId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!hotelId) {
        return {
          services: [] as OpsServiceSli[],
          incidents: null as OpsIncidentSli | null,
        };
      }

      const [servicesResult, incidentResult] = await Promise.all([
        supabaseUntyped
          .from("ops_service_sli_view")
          .select("*")
          .eq("hotel_id", hotelId)
          .order("service_key", { ascending: true }),
        supabaseUntyped
          .from("ops_incident_sli_view")
          .select("*")
          .eq("hotel_id", hotelId)
          .maybeSingle(),
      ]);

      if (servicesResult.error) throw servicesResult.error;
      if (incidentResult.error) throw incidentResult.error;

      const services = (servicesResult.data ?? []) as OpsServiceSli[];
      const incidentRow = incidentResult.data as Record<string, unknown> | null;

      const incidents = incidentRow
        ? ({
            hotel_id: String(incidentRow.hotel_id),
            mtta_minutes_30d: Number(incidentRow.mtta_minutes_30d ?? 0),
            mttr_minutes_30d: Number(incidentRow.mttr_minutes_30d ?? 0),
            incidents_by_severity_30d:
              (incidentRow.incidents_by_severity_30d as Record<string, number> | null) ?? {},
            open_backlog_by_age:
              (incidentRow.open_backlog_by_age as OpsIncidentSli["open_backlog_by_age"] | null) ?? {
                lt_30m: 0,
                btw_30m_2h: 0,
                btw_2h_8h: 0,
                gte_8h: 0,
                total_open: 0,
              },
          } satisfies OpsIncidentSli)
        : null;

      return {
        services,
        incidents,
      };
    },
  });
}

export function useOpsSloTargets() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-slo-targets", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return null as OpsSloTarget | null;

      const { data, error } = await supabaseUntyped
        .from("ops_slo_targets")
        .select("*")
        .eq("hotel_id", hotelId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        hotel_id: String(data.hotel_id),
        uptime_target_24h: Number(data.uptime_target_24h ?? 0),
        uptime_target_7d: Number(data.uptime_target_7d ?? 0),
        mtta_target_minutes: Number(data.mtta_target_minutes ?? 0),
        mttr_target_minutes: Number(data.mttr_target_minutes ?? 0),
        max_open_incidents_target: Number(data.max_open_incidents_target ?? 0),
        service_targets: (data.service_targets as Record<string, number> | null) ?? {},
      } satisfies OpsSloTarget;
    },
  });
}

export function useOpsWeeklySnapshots(limit = 8) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-weekly-snapshots", hotelId, limit],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [] as OpsWeeklySnapshot[];

      const { data, error } = await supabaseUntyped
        .from("ops_weekly_snapshots")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("week_start", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        hotel_id: String(row.hotel_id),
        week_start: String(row.week_start),
        week_end: String(row.week_end),
        total_incidents: Number(row.total_incidents ?? 0),
        auto_resolved_pct: Number(row.auto_resolved_pct ?? 0),
        mtta_minutes: row.mtta_minutes === null ? null : Number(row.mtta_minutes),
        mttr_minutes: row.mttr_minutes === null ? null : Number(row.mttr_minutes),
        root_causes:
          (row.root_causes as Array<{ cause: string; count: number }> | null) ?? [],
        generated_by: String(row.generated_by ?? "system"),
        generated_at: String(row.generated_at ?? row.created_at ?? ""),
      }));
    },
  });
}

export function useOpsAutopilotHealth() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["ops-autopilot-health", hotelId],
    enabled: !!hotelId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!hotelId) return null as OpsAutopilotHealth | null;

      const { data, error } = await supabaseUntyped
        .from("ops_autopilot_health_view")
        .select("*")
        .eq("hotel_id", hotelId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        hotel_id: String(data.hotel_id),
        bridge_status: String(data.bridge_status ?? "degraded") as OpsAutopilotHealth["bridge_status"],
        runs_30m: Number(data.runs_30m ?? 0),
        success_count_30m: Number(data.success_count_30m ?? 0),
        failed_count_30m: Number(data.failed_count_30m ?? 0),
        skipped_count_30m: Number(data.skipped_count_30m ?? 0),
        avg_duration_ms_30m: Number(data.avg_duration_ms_30m ?? 0),
        last_run_at: (data.last_run_at as string | null) ?? null,
        last_success_at: (data.last_success_at as string | null) ?? null,
        last_failure_at: (data.last_failure_at as string | null) ?? null,
      };
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

function invalidateOpsAutomationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["ops-center-monitoring"] });
  queryClient.invalidateQueries({ queryKey: ["ops-incidents"] });
  queryClient.invalidateQueries({ queryKey: ["ops-incident-events"] });
  queryClient.invalidateQueries({ queryKey: ["ops-escalations"] });
  queryClient.invalidateQueries({ queryKey: ["ops-automation-runs"] });
  queryClient.invalidateQueries({ queryKey: ["ops-autopilot-health"] });
  queryClient.invalidateQueries({ queryKey: ["ops-sli-panel"] });
}

export function useRunOpsAutopilot() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload?: { maxIncidents?: number }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { data, error } = await supabase.functions.invoke("ops-autopilot", {
        body: {
          hotel_id: hotelId,
          max_incidents: payload?.maxIncidents ?? 120,
        },
      });

      if (error) throw error;
      return data as {
        success: boolean;
        processed_incidents: number;
        auto_remediation?: { attempted: number; success: number; failed: number; skipped: number };
        escalations?: { opened: number; reminders: number; resolved: number };
      };
    },
    onSuccess: (result) => {
      invalidateOpsAutomationQueries(queryClient);
      toast({
        title: "Autopilot ejecutado",
        description: `Incidentes procesados: ${result?.processed_incidents ?? 0}.`,
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

export function useGenerateOpsWeeklyKpi() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload?: { weekStart?: string }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { data, error } = await supabase.functions.invoke("ops-weekly-kpi", {
        body: {
          hotel_id: hotelId,
          week_start: payload?.weekStart ?? null,
        },
      });

      if (error) throw error;
      return data as { success: boolean; generated_count?: number; week_start?: string; week_end?: string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ops-weekly-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["ops-sli-panel"] });
      toast({
        title: "KPI semanal generado",
        description: `Snapshots generados: ${result?.generated_count ?? 0}.`,
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
