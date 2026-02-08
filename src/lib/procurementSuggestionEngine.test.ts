import { describe, expect, test } from "vitest";
import {
  calculateSuggestedQty,
  generateProcurementSuggestions,
} from "./procurementSuggestionEngine";

describe("procurementSuggestionEngine", () => {
  test("computes demand as forecast + events + menu", () => {
    const qty = calculateSuggestedQty({
      productId: "p1",
      productName: "Tomate",
      forecastQty: 10,
      eventQty: 8,
      menuQty: 2,
      currentQty: 5,
    });
    expect(qty).toBe(15);
  });

  test("discounts usable stock", () => {
    const qty = calculateSuggestedQty({
      productId: "p1",
      productName: "Tomate",
      forecastQty: 20,
      eventQty: 0,
      menuQty: 0,
      currentQty: 18,
      reservedQty: 3,
    });
    expect(qty).toBe(5);
  });

  test("adds lead-time buffer", () => {
    const qty = calculateSuggestedQty({
      productId: "p1",
      productName: "Tomate",
      forecastQty: 5,
      eventQty: 0,
      menuQty: 0,
      currentQty: 0,
      leadTimeDays: 3,
      dailyDemandRate: 2,
    });
    expect(qty).toBe(11);
  });

  test("rounds up by pack size", () => {
    const qty = calculateSuggestedQty({
      productId: "p1",
      productName: "Tomate",
      forecastQty: 11,
      eventQty: 0,
      menuQty: 0,
      currentQty: 0,
      packSize: 6,
    });
    expect(qty).toBe(12);
  });

  test("returns suggestion payload", () => {
    const suggestions = generateProcurementSuggestions([
      {
        productId: "p1",
        productName: "Tomate",
        forecastQty: 6,
        eventQty: 2,
        menuQty: 0,
        currentQty: 1,
      },
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].recommended_qty).toBeGreaterThan(0);
  });
});
