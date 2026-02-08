import { describe, expect, test } from "vitest";
import { computeWasteMetrics } from "./wasteMetrics";

describe("wasteMetrics", () => {
  test("aggregates waste by product/category/period", () => {
    const metrics = computeWasteMetrics(
      [
        { productId: "tomato", categoryId: "veg", qty: 3, cause: "expired", recordedAt: "2026-02-05" },
        { productId: "tomato", categoryId: "veg", qty: 2, cause: "damage", recordedAt: "2026-02-05" },
        { productId: "fish", categoryId: "protein", qty: 5, cause: "spoilage", recordedAt: "2026-02-06" },
      ],
      { from: "2026-02-05", to: "2026-02-06" },
    );

    expect(metrics.totalQty).toBe(10);
    expect(metrics.byProduct[0]).toEqual({ productId: "tomato", qty: 5 });
    expect(metrics.byCategory.find((item) => item.categoryId === "veg")?.qty).toBe(5);
  });
});
