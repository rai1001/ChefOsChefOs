import { buildWatchdogSummary } from "@/lib/opsWatchdog";

describe("opsWatchdog", () => {
  it("computes uptime and queue backlog", () => {
    const now = new Date("2026-02-16T20:00:00.000Z");
    const summary = buildWatchdogSummary(
      [
        {
          id: "1",
          service_key: "web_app",
          status: "ok",
          latency_ms: 120,
          queue_depth: 1,
          detail: null,
          observed_at: "2026-02-16T19:58:00.000Z",
        },
        {
          id: "2",
          service_key: "jobs_worker",
          status: "degraded",
          latency_ms: 980,
          queue_depth: 12,
          detail: "retry loop",
          observed_at: "2026-02-16T19:57:00.000Z",
        },
      ],
      { now },
    );

    expect(summary.uptime24hPct).toBe(100);
    expect(summary.maxQueueDepth).toBe(12);
    expect(summary.degradedServices).toBe(1);
    expect(summary.alerts.some((alert) => alert.id.includes("queue-warning"))).toBe(true);
  });

  it("flags stale and down services as critical", () => {
    const now = new Date("2026-02-16T20:00:00.000Z");
    const summary = buildWatchdogSummary(
      [
        {
          id: "1",
          service_key: "sync_pipeline",
          status: "down",
          latency_ms: null,
          queue_depth: 30,
          detail: "worker crashed",
          observed_at: "2026-02-16T18:00:00.000Z",
        },
      ],
      { now, staleAfterMinutes: 20 },
    );

    expect(summary.downServices).toBe(1);
    expect(summary.alerts.some((alert) => alert.id === "down-sync_pipeline")).toBe(true);
    expect(summary.alerts.some((alert) => alert.id === "stale-sync_pipeline")).toBe(true);
    expect(summary.alerts.some((alert) => alert.id === "queue-critical-sync_pipeline")).toBe(true);
  });
});
