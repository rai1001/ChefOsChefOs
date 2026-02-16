import type { OpsServiceKey } from "@/lib/opsWatchdog";

export type OpsIncidentSeverity = "critical" | "high" | "medium" | "low";
export type OpsIncidentStatus = "open" | "investigating" | "mitigated" | "resolved";
export type OpsIncidentSource = "system" | "sync" | "jobs" | "backup" | "manual";

export interface OpsIncidentForAutomation {
  id: string;
  title: string;
  summary: string | null;
  severity: OpsIncidentSeverity;
  status: OpsIncidentStatus;
  source: OpsIncidentSource;
  runbook_slug: string | null;
  opened_at: string;
}

export type OpsAutoRemediationActionKey =
  | "retry_sync_job"
  | "drain_jobs_queue"
  | "restart_stale_worker";

export interface OpsAutoRemediationAction {
  actionKey: OpsAutoRemediationActionKey;
  serviceKey: OpsServiceKey;
  cooldownMinutes: number;
  label: string;
}

export interface OpsEscalationPolicy {
  severity: OpsIncidentSeverity;
  escalateAfterMinutes: number;
  reminderEveryMinutes: number;
  active: boolean;
}

export interface OpsEscalationState {
  status: "active" | "resolved" | "suppressed";
  next_reminder_at: string;
  reminder_count: number;
}

export type EscalationDecision =
  | {
      kind: "none";
      reason: string;
    }
  | {
      kind: "escalate";
      reason: string;
      nextReminderAt: string;
    }
  | {
      kind: "remind";
      reason: string;
      nextReminderAt: string;
      reminderCount: number;
    }
  | {
      kind: "resolve";
      reason: string;
    };

const SERVICE_KEY_PATTERNS: Array<{ key: OpsServiceKey; patterns: string[] }> = [
  { key: "web_app", patterns: ["web_app", "web app", "frontend"] },
  { key: "sync_pipeline", patterns: ["sync_pipeline", "sync pipeline", "sync"] },
  { key: "jobs_worker", patterns: ["jobs_worker", "jobs worker", "worker", "cola", "queue"] },
  { key: "alert_dispatcher", patterns: ["alert_dispatcher", "alert dispatcher", "alerts"] },
  { key: "backup_monitor", patterns: ["backup_monitor", "backup monitor", "backup"] },
];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[^a-z0-9_\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIso(input: string): Date | null {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function withMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function inferServiceFromText(text: string): OpsServiceKey | null {
  for (const entry of SERVICE_KEY_PATTERNS) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      return entry.key;
    }
  }
  return null;
}

function incidentContextText(incident: OpsIncidentForAutomation) {
  return normalizeText(`${incident.title} ${incident.summary ?? ""}`);
}

function isHeartbeatStaleIncident(incident: OpsIncidentForAutomation, normalizedText: string) {
  if (normalizedText.includes("heartbeat atrasado")) return true;
  if (normalizedText.includes("heartbeat stale")) return true;
  if (normalizedText.includes("service heartbeat stale")) return true;
  if (incident.runbook_slug === "service-heartbeat-stale") return true;
  return false;
}

export function mapIncidentToAutoRemediationAction(
  incident: OpsIncidentForAutomation,
): OpsAutoRemediationAction | null {
  const normalizedText = incidentContextText(incident);

  if (isHeartbeatStaleIncident(incident, normalizedText)) {
    return {
      actionKey: "restart_stale_worker",
      serviceKey:
        inferServiceFromText(normalizedText) ??
        (incident.source === "sync" ? "sync_pipeline" : "jobs_worker"),
      cooldownMinutes: 20,
      label: "Restart controlado de worker por heartbeat stale",
    };
  }

  if (incident.runbook_slug === "sync-delayed" || incident.source === "sync") {
    return {
      actionKey: "retry_sync_job",
      serviceKey: "sync_pipeline",
      cooldownMinutes: 10,
      label: "Relanzar job de sincronizacion",
    };
  }

  if (incident.runbook_slug === "jobs-queue-backlog" || incident.source === "jobs") {
    return {
      actionKey: "drain_jobs_queue",
      serviceKey: "jobs_worker",
      cooldownMinutes: 8,
      label: "Drenar y reintentar cola de jobs",
    };
  }

  return null;
}

export function escalationLevelFromSeverity(
  severity: OpsIncidentSeverity,
  reminderCount = 0,
): number {
  const base: Record<OpsIncidentSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return Math.max(1, Math.min(10, base[severity] + Math.max(0, reminderCount)));
}

export function computeEscalationDecision(input: {
  incident: OpsIncidentForAutomation;
  policy: OpsEscalationPolicy;
  existingEscalation: OpsEscalationState | null;
  now: Date;
}): EscalationDecision {
  const { incident, policy, existingEscalation, now } = input;

  if (!policy.active) {
    return { kind: "none", reason: "policy_inactive" };
  }

  const isMitigatedOrResolved =
    incident.status === "mitigated" || incident.status === "resolved";

  if (isMitigatedOrResolved) {
    if (existingEscalation?.status === "active") {
      return { kind: "resolve", reason: "incident_mitigated_or_resolved" };
    }
    return { kind: "none", reason: "incident_mitigated_or_resolved" };
  }

  const openedAt = parseIso(incident.opened_at);
  if (!openedAt) {
    return { kind: "none", reason: "invalid_opened_at" };
  }

  if (!existingEscalation || existingEscalation.status !== "active") {
    const ageMinutes = Math.floor((now.getTime() - openedAt.getTime()) / 60_000);
    if (ageMinutes >= policy.escalateAfterMinutes) {
      return {
        kind: "escalate",
        reason: "sla_breached",
        nextReminderAt: withMinutes(now, policy.reminderEveryMinutes),
      };
    }
    return { kind: "none", reason: "within_sla" };
  }

  const reminderDueAt = parseIso(existingEscalation.next_reminder_at);
  if (!reminderDueAt) {
    return {
      kind: "remind",
      reason: "missing_next_reminder",
      nextReminderAt: withMinutes(now, policy.reminderEveryMinutes),
      reminderCount: existingEscalation.reminder_count + 1,
    };
  }

  if (now >= reminderDueAt) {
    return {
      kind: "remind",
      reason: "reminder_due",
      nextReminderAt: withMinutes(now, policy.reminderEveryMinutes),
      reminderCount: existingEscalation.reminder_count + 1,
    };
  }

  return { kind: "none", reason: "reminder_not_due" };
}

export function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}
