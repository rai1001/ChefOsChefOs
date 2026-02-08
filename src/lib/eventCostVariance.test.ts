import { describe, expect, test } from "vitest";
import { calculateEventCostVariance, getTopProductDeviations } from "./eventCostVariance";

describe("eventCostVariance", () => {
  test("calculates variance for event with menu baseline", () => {
    const variance = calculateEventCostVariance({
      eventId: "e1",
      pax: 100,
      baselineCostTotal: 1000,
      actualCostTotal: 1150,
    });

    expect(variance.deltaAmount).toBe(150);
    expect(variance.deltaPct).toBe(15);
  });

  test("returns null pct when event has no baseline", () => {
    const variance = calculateEventCostVariance({
      eventId: "e2",
      pax: 50,
      baselineCostTotal: 0,
      actualCostTotal: 200,
    });

    expect(variance.deltaPct).toBeNull();
  });

  test("ranks top deviations with partial consumptions", () => {
    const top = getTopProductDeviations([
      { productId: "fish", baselineCost: 400, actualCost: 600 },
      { productId: "tomato", baselineCost: 100, actualCost: 120 },
      { productId: "rice", baselineCost: 200, actualCost: 160 },
    ]);

    expect(top[0].productId).toBe("fish");
    expect(top).toHaveLength(3);
  });
});
