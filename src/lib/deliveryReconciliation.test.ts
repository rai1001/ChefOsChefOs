import { describe, expect, test } from "vitest";
import { reconcileDelivery } from "./deliveryReconciliation";

describe("deliveryReconciliation", () => {
  test("matches normalized names and detects quantity/price deltas", () => {
    const result = reconcileDelivery(
      [
        { id: "1", name: "Tomate Cherry", quantity: 10, unitPrice: 2.5 },
        { id: "2", name: "Aceite Oliva", quantity: 5, unitPrice: 8 },
      ],
      [
        { name: "tomate-cherry", quantity: 9, unitPrice: 2.7 },
        { name: "Arroz", quantity: 3, unitPrice: 1.2 },
      ],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].quantityDelta).toBe(-1);
    expect(result.missing).toHaveLength(1);
    expect(result.unexpected).toHaveLength(1);
    expect(result.hasIssues).toBe(true);
  });
});
