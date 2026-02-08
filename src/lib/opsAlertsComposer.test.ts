import { describe, expect, test } from "vitest";
import { composeOpsAlerts } from "./opsAlertsComposer";

describe("opsAlertsComposer", () => {
  test("composes alerts from deterministic counters", () => {
    const alerts = composeOpsAlerts({
      criticalStockCount: 2,
      urgentPurchaseCount: 1,
      overdueTaskCount: 3,
      eventsWithoutMenuCount: 1,
    });

    expect(alerts).toHaveLength(4);
    expect(alerts.some((a) => a.key === "critical_stock")).toBe(true);
  });
});
