import { describe, expect, test } from "vitest";
import {
  calculateSuggestedReplenishment,
  getStockSeverity,
  resolveStockThresholds,
} from "./stockThresholds";

describe("stockThresholds", () => {
  test("uses category fallback when product thresholds are missing", () => {
    const resolved = resolveStockThresholds({
      minStock: null,
      optimalStock: null,
      criticalStock: null,
      categoryMinStock: 20,
      categoryOptimalStock: 35,
      categoryCriticalStock: 8,
    });

    expect(resolved).toEqual({
      minStock: 20,
      optimalStock: 35,
      criticalStock: 8,
    });
  });

  test("normalizes ordering critical <= min <= optimal", () => {
    const resolved = resolveStockThresholds({
      minStock: 12,
      optimalStock: 8,
      criticalStock: 15,
    });

    expect(resolved.minStock).toBe(15);
    expect(resolved.optimalStock).toBe(15);
    expect(resolved.criticalStock).toBe(15);
  });

  test("classifies stock severity and replenishment qty", () => {
    const thresholds = resolveStockThresholds({
      minStock: 20,
      optimalStock: 30,
      criticalStock: 10,
    });

    expect(getStockSeverity(5, thresholds)).toBe("critical");
    expect(getStockSeverity(15, thresholds)).toBe("medium");
    expect(getStockSeverity(22, thresholds)).toBe("low");
    expect(getStockSeverity(35, thresholds)).toBe("healthy");
    expect(calculateSuggestedReplenishment(12, thresholds)).toBe(18);
  });
});
