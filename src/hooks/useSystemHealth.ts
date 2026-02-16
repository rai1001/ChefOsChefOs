import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  combineHealth,
  type HealthLevel,
  type HealthSignal,
} from "@/lib/healthStatus";
import { captureRuntimeError } from "@/lib/runtimeErrorLogger";

interface OpsLogRow {
  id: string;
  entity: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor_user_id?: string | null;
}

export interface SystemHealthSnapshot {
  generatedAt: string;
  overallStatus: HealthLevel;
  signals: HealthSignal[];
  recentErrors: OpsLogRow[];
  recentTechnicalEvents: OpsLogRow[];
  summary: {
    dbLatencyMs: number | null;
    recentErrorCount: number;
    activeAutomations: number;
    lastBackupAt: string | null;
  };
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function minutesSince(ts: number | null, nowTs: number) {
  if (ts === null) return null;
  return Math.max(0, Math.floor((nowTs - ts) / 60_000));
}

function hoursSince(ts: number | null, nowTs: number) {
  if (ts === null) return null;
  return Math.max(0, Math.floor((nowTs - ts) / 3_600_000));
}

function formatElapsed(minutes: number | null) {
  if (minutes === null) return "sin registro";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export function useSystemHealth() {
  const hotelId = useCurrentHotelId();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return useQuery({
    queryKey: ["system-health", hotelId, isSuperAdmin],
    enabled: !!hotelId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<SystemHealthSnapshot> => {
      if (!hotelId) {
        throw new Error("No hay hotel seleccionado");
      }

      const nowTs = Date.now();
      const dayAgoIso = new Date(nowTs - 24 * 3_600_000).toISOString();

      const probeStart = performance.now();
      const { error: systemProbeError } = await supabase
        .from("hotels")
        .select("id")
        .eq("id", hotelId)
        .limit(1);
      const dbLatencyMs = Math.round(performance.now() - probeStart);

      if (systemProbeError) {
        void captureRuntimeError("status_probe_error", systemProbeError, {
          area: "system_probe",
        });
      }

      const [
        latestForecastResult,
        latestEventResult,
        subscriptionResult,
        activeAgentsResult,
        auditResult,
      ] = await Promise.all([
        supabaseUntyped
          .from("forecasts")
          .select("updated_at, forecast_date")
          .eq("hotel_id", hotelId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseUntyped
          .from("events")
          .select("updated_at, event_date")
          .eq("hotel_id", hotelId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseUntyped
          .from("alert_subscriptions")
          .select("id, enabled, updated_at")
          .eq("hotel_id", hotelId)
          .eq("enabled", true),
        supabaseUntyped
          .from("agent_connections")
          .select("id")
          .eq("hotel_id", hotelId)
          .eq("status", "active"),
        supabaseUntyped
          .from("ops_audit_log")
          .select("id, entity, action, payload, created_at, actor_user_id")
          .eq("hotel_id", hotelId)
          .order("created_at", { ascending: false })
          .limit(150),
      ]);

      const softErrors = [
        latestForecastResult.error,
        latestEventResult.error,
        subscriptionResult.error,
        activeAgentsResult.error,
        auditResult.error,
      ].filter(Boolean);

      if (softErrors.length > 0) {
        void captureRuntimeError("status_probe_error", softErrors[0], {
          area: "health_queries",
          count: softErrors.length,
        });
      }

      const latestForecastTs = parseDate(latestForecastResult.data?.updated_at ?? null);
      const latestEventTs = parseDate(latestEventResult.data?.updated_at ?? null);
      const latestSyncTs = [latestForecastTs, latestEventTs].reduce<number | null>(
        (acc, value) => {
          if (value === null) return acc;
          if (acc === null) return value;
          return value > acc ? value : acc;
        },
        null,
      );

      const latestSyncMinutes = minutesSince(latestSyncTs, nowTs);
      const activeSubscriptions = subscriptionResult.data?.length ?? 0;
      const activeAgents = activeAgentsResult.data?.length ?? 0;
      const activeAutomations = activeSubscriptions + activeAgents;

      const auditRows = (auditResult.data ?? []) as OpsLogRow[];
      const recentErrors = auditRows.filter((row) => {
        const ts = parseDate(row.created_at);
        const inLast24h = ts !== null && ts >= nowTs - 24 * 3_600_000;
        const errorLike =
          row.entity.toLowerCase().includes("error") || row.action.toLowerCase().includes("error");
        return inLast24h && errorLike;
      });

      const recentTechnicalEvents = auditRows.slice(0, 20);

      const automationEvent = auditRows.find((row) => {
        const entity = row.entity.toLowerCase();
        return entity === "agent_bridge" || entity === "alert_subscription";
      });

      const lastAutomationMinutes = minutesSince(
        parseDate(automationEvent?.created_at),
        nowTs,
      );

      const backupEvent = auditRows.find((row) => {
        const text = `${row.entity} ${row.action}`.toLowerCase();
        return text.includes("backup") || text.includes("restore");
      });

      const lastBackupTs = parseDate(backupEvent?.created_at);
      const lastBackupHours = hoursSince(lastBackupTs, nowTs);

      const signals: HealthSignal[] = [
        systemProbeError
          ? {
              key: "system",
              label: "Sistema",
              status: "critical",
              detail: "No se pudo confirmar conectividad con base de datos.",
              metric: "sin respuesta",
              updatedAt: null,
            }
          : dbLatencyMs > 1800
            ? {
                key: "system",
                label: "Sistema",
                status: "warning",
                detail: "Respuesta lenta del sistema base.",
                metric: `${dbLatencyMs} ms`,
                updatedAt: new Date(nowTs).toISOString(),
              }
            : {
                key: "system",
                label: "Sistema",
                status: "healthy",
                detail: "Conectividad operativa.",
                metric: `${dbLatencyMs} ms`,
                updatedAt: new Date(nowTs).toISOString(),
              },
        latestSyncMinutes === null
          ? {
              key: "sync",
              label: "Sync",
              status: "warning",
              detail: "No hay señales recientes de sincronización.",
              metric: "sin datos",
              updatedAt: null,
            }
          : latestSyncMinutes > 24 * 60
            ? {
                key: "sync",
                label: "Sync",
                status: "critical",
                detail: "Sincronización desactualizada.",
                metric: formatElapsed(latestSyncMinutes),
                updatedAt: latestForecastResult.data?.updated_at ?? latestEventResult.data?.updated_at,
              }
            : latestSyncMinutes > 12 * 60
              ? {
                  key: "sync",
                  label: "Sync",
                  status: "warning",
                  detail: "Sincronización con retraso.",
                  metric: formatElapsed(latestSyncMinutes),
                  updatedAt: latestForecastResult.data?.updated_at ?? latestEventResult.data?.updated_at,
                }
              : {
                  key: "sync",
                  label: "Sync",
                  status: "healthy",
                  detail: "Datos sincronizados recientemente.",
                  metric: formatElapsed(latestSyncMinutes),
                  updatedAt: latestForecastResult.data?.updated_at ?? latestEventResult.data?.updated_at,
                },
        activeAutomations === 0
          ? {
              key: "jobs",
              label: "Jobs",
              status: "warning",
              detail: "No hay automatizaciones activas en este hotel.",
              metric: "0 activas",
              updatedAt: null,
            }
          : lastAutomationMinutes !== null && lastAutomationMinutes > 24 * 60
            ? {
                key: "jobs",
                label: "Jobs",
                status: "warning",
                detail: "Sin actividad reciente en automatizaciones.",
                metric: `${activeAutomations} activas`,
                updatedAt: automationEvent?.created_at ?? null,
              }
            : {
                key: "jobs",
                label: "Jobs",
                status: "healthy",
                detail: "Automatizaciones activas.",
                metric: `${activeAutomations} activas`,
                updatedAt: automationEvent?.created_at ?? null,
              },
        recentErrors.length >= 8
          ? {
              key: "errors",
              label: "Errores",
              status: "critical",
              detail: "Volumen alto de errores en las últimas 24h.",
              metric: `${recentErrors.length}/24h`,
              updatedAt: recentErrors[0]?.created_at ?? null,
            }
          : recentErrors.length > 0
            ? {
                key: "errors",
                label: "Errores",
                status: "warning",
                detail: "Se detectaron errores recientes.",
                metric: `${recentErrors.length}/24h`,
                updatedAt: recentErrors[0]?.created_at ?? null,
              }
            : {
                key: "errors",
                label: "Errores",
                status: "healthy",
                detail: "Sin errores registrados en las últimas 24h.",
                metric: "0/24h",
                updatedAt: null,
              },
        lastBackupHours === null
          ? {
              key: "backup",
              label: "Backup",
              status: "warning",
              detail: "No hay verificación de backup registrada.",
              metric: "pendiente",
              updatedAt: null,
            }
          : lastBackupHours > 48
            ? {
                key: "backup",
                label: "Backup",
                status: "critical",
                detail: "Backup sin verificación reciente.",
                metric: `${lastBackupHours} h`,
                updatedAt: backupEvent?.created_at ?? null,
              }
            : lastBackupHours > 24
              ? {
                  key: "backup",
                  label: "Backup",
                  status: "warning",
                  detail: "Conviene ejecutar verificación de restauración.",
                  metric: `${lastBackupHours} h`,
                  updatedAt: backupEvent?.created_at ?? null,
                }
              : {
                  key: "backup",
                  label: "Backup",
                  status: "healthy",
                  detail: "Verificación reciente registrada.",
                  metric: `${lastBackupHours} h`,
                  updatedAt: backupEvent?.created_at ?? null,
                },
      ];

      return {
        generatedAt: new Date(nowTs).toISOString(),
        overallStatus: combineHealth(signals),
        signals,
        recentErrors,
        recentTechnicalEvents,
        summary: {
          dbLatencyMs: systemProbeError ? null : dbLatencyMs,
          recentErrorCount: recentErrors.length,
          activeAutomations,
          lastBackupAt: backupEvent?.created_at ?? null,
        },
      };
    },
  });
}
