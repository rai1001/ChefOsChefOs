import { buildWatchdogSummary } from "@/lib/opsWatchdog";
import {
  computeEscalationDecision,
  mapIncidentToAutoRemediationAction,
  type OpsEscalationPolicy,
} from "@/lib/opsAutopilot";

describe("opsAutopilot integration", () => {
  it("translates critical watchdog stale heartbeat into remediation and escalation", () => {
    const now = new Date("2026-02-16T20:00:00.000Z");

    const watchdog = buildWatchdogSummary(
      [
        {
          id: "hb-1",
          service_key: "jobs_worker",
          status: "down",
          latency_ms: null,
          queue_depth: 33,
          detail: "worker crashed",
          observed_at: "2026-02-16T19:10:00.000Z",
        },
      ],
      { now, staleAfterMinutes: 20 },
    );

    const staleAlert = watchdog.alerts.find((alert) => alert.id === "stale-jobs_worker");
    expect(staleAlert).toBeDefined();

    const incident = {
      id: "inc-stale-1",
      title: staleAlert?.title ?? "Heartbeat atrasado en jobs_worker",
      summary: staleAlert?.detail ?? "Ultimo reporte hace 40 min.",
      severity: "critical" as const,
      status: "open" as const,
      source: "jobs" as const,
      runbook_slug: "service-heartbeat-stale",
      opened_at: "2026-02-16T19:10:00.000Z",
    };

    const action = mapIncidentToAutoRemediationAction(incident);
    expect(action?.actionKey).toBe("restart_stale_worker");
    expect(action?.serviceKey).toBe("jobs_worker");

    const policy: OpsEscalationPolicy = {
      severity: "critical",
      escalateAfterMinutes: 0,
      reminderEveryMinutes: 15,
      active: true,
    };

    const escalationDecision = computeEscalationDecision({
      incident,
      policy,
      existingEscalation: null,
      now,
    });

    expect(escalationDecision.kind).toBe("escalate");
  });
});
