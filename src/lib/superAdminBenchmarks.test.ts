import { describe, expect, test } from "vitest";
import { rankHotelBenchmarks } from "./superAdminBenchmarks";

describe("superAdminBenchmarks", () => {
  test("ranks hotels by composed KPI score", () => {
    const ranked = rankHotelBenchmarks([
      {
        hotel_id: "h1",
        hotel_name: "A",
        cost_per_pax_30d: 20,
        waste_qty_30d: 40,
        task_completion_pct_30d: 80,
        purchase_on_time_pct_30d: 90,
      },
      {
        hotel_id: "h2",
        hotel_name: "B",
        cost_per_pax_30d: 10,
        waste_qty_30d: 10,
        task_completion_pct_30d: 92,
        purchase_on_time_pct_30d: 95,
      },
    ]);

    expect(ranked[0].hotel_id).toBe("h2");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
