export type OpsServiceKey =
  | "web_app"
  | "sync_pipeline"
  | "jobs_worker"
  | "alert_dispatcher"
  | "backup_monitor";

export type OpsServiceStatus = "ok" | "degraded" | "down";

export interface OpsServiceHeartbeat {
  id: string;
  service_key: OpsServiceKey;
  status: OpsServiceStatus;
  latency_ms: number | null;
  queue_depth: number | null;
  detail: string | null;
  observed_at: string;
}

export type WatchdogSeverity = "critical" | "warning";

export interface WatchdogAlert {
  id: string;
  serviceKey: OpsServiceKey;
  severity: WatchdogSeverity;
  title: string;
  detail: string;
}

export interface WatchdogSummary {
  uptime24hPct: number;
  maxQueueDepth: number;
  degradedServices: number;
  downServices: number;
  alerts: WatchdogAlert[];
  latestByService: Record<OpsServiceKey, OpsServiceHeartbeat | null>;
}

const SERVICE_KEYS: OpsServiceKey[] = [
  "web_app",
  "sync_pipeline",
  "jobs_worker",
  "alert_dispatcher",
  "backup_monitor",
];

function sortAlerts(alerts: WatchdogAlert[]) {
  return [...alerts].sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "critical" ? -1 : 1;
    }
    return a.serviceKey.localeCompare(b.serviceKey);
  });
}

function minutesSince(observedAt: string, now: Date) {
  const ts = new Date(observedAt).getTime();
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - ts) / 60000));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildWatchdogSummary(
  heartbeats: OpsServiceHeartbeat[],
  options?: { now?: Date; staleAfterMinutes?: number },
): WatchdogSummary {
  const now = options?.now ?? new Date();
  const staleAfterMinutes = options?.staleAfterMinutes ?? 20;

  const rowsLast24h = heartbeats.filter((row) => {
    const ts = new Date(row.observed_at).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= now.getTime() - 24 * 60 * 60000;
  });

  const latestByService: Record<OpsServiceKey, OpsServiceHeartbeat | null> = {
    web_app: null,
    sync_pipeline: null,
    jobs_worker: null,
    alert_dispatcher: null,
    backup_monitor: null,
  };

  for (const serviceKey of SERVICE_KEYS) {
    const latest = rowsLast24h
      .filter((row) => row.service_key === serviceKey)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    latestByService[serviceKey] = latest ?? null;
  }

  const okRows = rowsLast24h.filter((row) => row.status !== "down");
  const uptime24hPct = rowsLast24h.length > 0 ? round((okRows.length / rowsLast24h.length) * 100) : 0;

  const maxQueueDepth = rowsLast24h.reduce((max, row) => {
    const depth = row.queue_depth ?? 0;
    return depth > max ? depth : max;
  }, 0);

  let degradedServices = 0;
  let downServices = 0;
  const alerts: WatchdogAlert[] = [];

  for (const serviceKey of SERVICE_KEYS) {
    const latest = latestByService[serviceKey];

    if (!latest) {
      alerts.push({
        id: `missing-${serviceKey}`,
        serviceKey,
        severity: "warning",
        title: `Sin heartbeat en ${serviceKey}`,
        detail: "No se registro actividad operativa para este servicio en 24h.",
      });
      continue;
    }

    const ageMinutes = minutesSince(latest.observed_at, now);

    if (latest.status === "down") {
      downServices += 1;
      alerts.push({
        id: `down-${serviceKey}`,
        serviceKey,
        severity: "critical",
        title: `${serviceKey} en estado DOWN`,
        detail: latest.detail ?? "Servicio reportado como no disponible.",
      });
    } else if (latest.status === "degraded") {
      degradedServices += 1;
      alerts.push({
        id: `degraded-${serviceKey}`,
        serviceKey,
        severity: "warning",
        title: `${serviceKey} degradado`,
        detail: latest.detail ?? "Servicio operativo con degradacion.",
      });
    }

    if (ageMinutes > staleAfterMinutes) {
      alerts.push({
        id: `stale-${serviceKey}`,
        serviceKey,
        severity: ageMinutes > staleAfterMinutes * 2 ? "critical" : "warning",
        title: `Heartbeat atrasado en ${serviceKey}`,
        detail: `Ultimo reporte hace ${ageMinutes} min.`,
      });
    }

    const queueDepth = latest.queue_depth ?? 0;
    if (queueDepth >= 25) {
      alerts.push({
        id: `queue-critical-${serviceKey}`,
        serviceKey,
        severity: "critical",
        title: `Cola alta en ${serviceKey}`,
        detail: `Backlog ${queueDepth} elementos.`,
      });
    } else if (queueDepth >= 10) {
      alerts.push({
        id: `queue-warning-${serviceKey}`,
        serviceKey,
        severity: "warning",
        title: `Cola en aumento en ${serviceKey}`,
        detail: `Backlog ${queueDepth} elementos.`,
      });
    }
  }

  return {
    uptime24hPct,
    maxQueueDepth,
    degradedServices,
    downServices,
    alerts: sortAlerts(alerts),
    latestByService,
  };
}

export function serviceKeyLabel(serviceKey: OpsServiceKey) {
  const labels: Record<OpsServiceKey, string> = {
    web_app: "Web App",
    sync_pipeline: "Sync Pipeline",
    jobs_worker: "Jobs Worker",
    alert_dispatcher: "Alert Dispatcher",
    backup_monitor: "Backup Monitor",
  };
  return labels[serviceKey];
}
