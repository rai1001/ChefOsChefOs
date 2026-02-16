export type OpsServiceKey =
  | "web_app"
  | "sync_pipeline"
  | "jobs_worker"
  | "alert_dispatcher"
  | "backup_monitor";

export type OpsIncidentSeverity = "critical" | "high" | "medium" | "low";
export type OpsIncidentStatus = "open" | "investigating" | "mitigated" | "resolved";
export type OpsIncidentSource = "system" | "sync" | "jobs" | "backup" | "manual";

export interface OpsIncidentForAutopilot {
  id: string;
  hotel_id: string;
  title: string;
  summary: string | null;
  severity: OpsIncidentSeverity;
  status: OpsIncidentStatus;
  source: OpsIncidentSource;
  runbook_slug: string | null;
  opened_at: string;
  escalation_state: string;
  escalation_level: number;
}

export interface OpsAutoRemediationAction {
  action_key: "retry_sync_job" | "drain_jobs_queue" | "restart_stale_worker";
  service_key: OpsServiceKey;
  cooldown_minutes: number;
  detail: string;
}

export interface OpsEscalationPolicy {
  hotel_id: string;
  severity: OpsIncidentSeverity;
  escalate_after_minutes: number;
  reminder_every_minutes: number;
  active: boolean;
}

export interface OpsEscalationRow {
  id: string;
  hotel_id: string;
  incident_id: string;
  status: "active" | "resolved" | "suppressed";
  next_reminder_at: string;
  reminder_count: number;
}

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[^a-z0-9_\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIso(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function withMinutes(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function inferServiceKey(text: string): OpsServiceKey | null {
  if (text.includes("sync_pipeline") || text.includes("sync pipeline") || text.includes("sync")) {
    return "sync_pipeline";
  }
  if (text.includes("jobs_worker") || text.includes("jobs worker") || text.includes("worker") || text.includes("cola") || text.includes("queue")) {
    return "jobs_worker";
  }
  if (text.includes("web_app") || text.includes("web app") || text.includes("frontend")) {
    return "web_app";
  }
  if (text.includes("alert_dispatcher") || text.includes("alert dispatcher") || text.includes("alerts")) {
    return "alert_dispatcher";
  }
  if (text.includes("backup_monitor") || text.includes("backup monitor") || text.includes("backup")) {
    return "backup_monitor";
  }
  return null;
}

function isHeartbeatStale(input: OpsIncidentForAutopilot, text: string) {
  if (input.runbook_slug === "service-heartbeat-stale") return true;
  if (text.includes("heartbeat atrasado")) return true;
  if (text.includes("heartbeat stale")) return true;
  if (text.includes("service heartbeat stale")) return true;
  return false;
}

export function mapIncidentToAction(
  incident: OpsIncidentForAutopilot,
): OpsAutoRemediationAction | null {
  const text = normalizeText(`${incident.title} ${incident.summary ?? ""}`);

  if (isHeartbeatStale(incident, text)) {
    return {
      action_key: "restart_stale_worker",
      service_key:
        inferServiceKey(text) ?? (incident.source === "sync" ? "sync_pipeline" : "jobs_worker"),
      cooldown_minutes: 20,
      detail: "restart_controlled_worker",
    };
  }

  if (incident.runbook_slug === "sync-delayed" || incident.source === "sync") {
    return {
      action_key: "retry_sync_job",
      service_key: "sync_pipeline",
      cooldown_minutes: 10,
      detail: "sync_job_relaunch",
    };
  }

  if (incident.runbook_slug === "jobs-queue-backlog" || incident.source === "jobs") {
    return {
      action_key: "drain_jobs_queue",
      service_key: "jobs_worker",
      cooldown_minutes: 8,
      detail: "queue_drain_retry",
    };
  }

  return null;
}

export function escalationLevel(
  severity: OpsIncidentSeverity,
  reminderCount: number,
): number {
  const base: Record<OpsIncidentSeverity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return Math.max(1, Math.min(10, base[severity] + Math.max(0, reminderCount)));
}

export type EscalationDecision =
  | { kind: "none"; reason: string }
  | { kind: "escalate"; reason: string; next_reminder_at: string }
  | {
      kind: "remind";
      reason: string;
      next_reminder_at: string;
      reminder_count: number;
    }
  | { kind: "resolve"; reason: string };

export function computeEscalationDecision(input: {
  incident: OpsIncidentForAutopilot;
  policy: OpsEscalationPolicy | null;
  escalation: OpsEscalationRow | null;
  now: Date;
}): EscalationDecision {
  if (!input.policy || !input.policy.active) {
    return { kind: "none", reason: "policy_missing_or_inactive" };
  }

  const isMitigatedOrResolved =
    input.incident.status === "mitigated" || input.incident.status === "resolved";

  if (isMitigatedOrResolved) {
    if (input.escalation?.status === "active") {
      return { kind: "resolve", reason: "incident_mitigated_or_resolved" };
    }
    return { kind: "none", reason: "incident_mitigated_or_resolved" };
  }

  const openedAt = parseIso(input.incident.opened_at);
  if (!openedAt) {
    return { kind: "none", reason: "invalid_opened_at" };
  }

  if (!input.escalation || input.escalation.status !== "active") {
    const ageMinutes = Math.floor((input.now.getTime() - openedAt.getTime()) / 60_000);
    if (ageMinutes >= input.policy.escalate_after_minutes) {
      return {
        kind: "escalate",
        reason: "sla_breached",
        next_reminder_at: withMinutes(input.now, input.policy.reminder_every_minutes),
      };
    }
    return { kind: "none", reason: "within_sla" };
  }

  const nextReminderAt = parseIso(input.escalation.next_reminder_at);
  if (!nextReminderAt || input.now >= nextReminderAt) {
    return {
      kind: "remind",
      reason: nextReminderAt ? "reminder_due" : "missing_next_reminder",
      next_reminder_at: withMinutes(input.now, input.policy.reminder_every_minutes),
      reminder_count: input.escalation.reminder_count + 1,
    };
  }

  return { kind: "none", reason: "reminder_not_due" };
}

export function dedupeIncidentsById(rows: OpsIncidentForAutopilot[]): OpsIncidentForAutopilot[] {
  const seen = new Set<string>();
  const out: OpsIncidentForAutopilot[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function nowIso() {
  return new Date().toISOString();
}

export function minutesFromNow(now: Date, minutes: number) {
  return withMinutes(now, minutes);
}
