import {
  computeEscalationDecision,
  dedupeByKey,
  escalationLevelFromSeverity,
  mapIncidentToAutoRemediationAction,
  type OpsIncidentForAutomation,
  type OpsEscalationPolicy,
} from "@/lib/opsAutopilot";

const baseIncident: OpsIncidentForAutomation = {
  id: "inc_1",
  title: "Sync atrasado",
  summary: "Sincronizacion retrasada",
  severity: "high",
  status: "open",
  source: "sync",
  runbook_slug: "sync-delayed",
  opened_at: "2026-02-16T10:00:00.000Z",
};

describe("opsAutopilot", () => {
  it("maps sync-delayed incidents to sync retry action", () => {
    const action = mapIncidentToAutoRemediationAction(baseIncident);
    expect(action?.actionKey).toBe("retry_sync_job");
    expect(action?.serviceKey).toBe("sync_pipeline");
    expect(action?.cooldownMinutes).toBe(10);
  });

  it("maps stale heartbeat incidents to controlled worker restart", () => {
    const action = mapIncidentToAutoRemediationAction({
      ...baseIncident,
      source: "jobs",
      runbook_slug: null,
      title: "Heartbeat atrasado en jobs_worker",
      summary: "service heartbeat stale",
    });

    expect(action?.actionKey).toBe("restart_stale_worker");
    expect(action?.serviceKey).toBe("jobs_worker");
    expect(action?.cooldownMinutes).toBe(20);
  });

  it("escalates critical incidents immediately", () => {
    const policy: OpsEscalationPolicy = {
      severity: "critical",
      escalateAfterMinutes: 0,
      reminderEveryMinutes: 15,
      active: true,
    };

    const decision = computeEscalationDecision({
      incident: {
        ...baseIncident,
        severity: "critical",
        opened_at: "2026-02-16T10:00:00.000Z",
      },
      policy,
      existingEscalation: null,
      now: new Date("2026-02-16T10:01:00.000Z"),
    });

    expect(decision.kind).toBe("escalate");
  });

  it("waits for SLA breach on high severity", () => {
    const policy: OpsEscalationPolicy = {
      severity: "high",
      escalateAfterMinutes: 30,
      reminderEveryMinutes: 30,
      active: true,
    };

    const decisionBefore = computeEscalationDecision({
      incident: baseIncident,
      policy,
      existingEscalation: null,
      now: new Date("2026-02-16T10:20:00.000Z"),
    });

    const decisionAfter = computeEscalationDecision({
      incident: baseIncident,
      policy,
      existingEscalation: null,
      now: new Date("2026-02-16T10:45:00.000Z"),
    });

    expect(decisionBefore.kind).toBe("none");
    expect(decisionAfter.kind).toBe("escalate");
  });

  it("emits reminders only when due", () => {
    const policy: OpsEscalationPolicy = {
      severity: "high",
      escalateAfterMinutes: 30,
      reminderEveryMinutes: 30,
      active: true,
    };

    const notDue = computeEscalationDecision({
      incident: baseIncident,
      policy,
      existingEscalation: {
        status: "active",
        next_reminder_at: "2026-02-16T11:00:00.000Z",
        reminder_count: 1,
      },
      now: new Date("2026-02-16T10:50:00.000Z"),
    });

    const due = computeEscalationDecision({
      incident: baseIncident,
      policy,
      existingEscalation: {
        status: "active",
        next_reminder_at: "2026-02-16T10:40:00.000Z",
        reminder_count: 1,
      },
      now: new Date("2026-02-16T10:50:00.000Z"),
    });

    expect(notDue.kind).toBe("none");
    expect(due.kind).toBe("remind");
    if (due.kind === "remind") {
      expect(due.reminderCount).toBe(2);
    }
  });

  it("resolves active escalation when incident gets mitigated", () => {
    const policy: OpsEscalationPolicy = {
      severity: "medium",
      escalateAfterMinutes: 120,
      reminderEveryMinutes: 120,
      active: true,
    };

    const decision = computeEscalationDecision({
      incident: {
        ...baseIncident,
        status: "mitigated",
        severity: "medium",
      },
      policy,
      existingEscalation: {
        status: "active",
        next_reminder_at: "2026-02-16T12:00:00.000Z",
        reminder_count: 2,
      },
      now: new Date("2026-02-16T11:00:00.000Z"),
    });

    expect(decision.kind).toBe("resolve");
  });

  it("deduplicates by key preserving first item", () => {
    const deduped = dedupeByKey(
      [
        { id: "a", key: "critical:1" },
        { id: "b", key: "critical:1" },
        { id: "c", key: "high:2" },
      ],
      (item) => item.key,
    );

    expect(deduped).toEqual([
      { id: "a", key: "critical:1" },
      { id: "c", key: "high:2" },
    ]);
  });

  it("computes escalation level by severity and reminders", () => {
    expect(escalationLevelFromSeverity("critical", 0)).toBe(4);
    expect(escalationLevelFromSeverity("high", 2)).toBe(5);
    expect(escalationLevelFromSeverity("low", 0)).toBe(1);
    expect(escalationLevelFromSeverity("critical", 99)).toBe(10);
  });
});
