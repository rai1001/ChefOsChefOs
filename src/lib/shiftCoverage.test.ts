import { buildShiftCoverageRows, getCoverageRowsByDate } from "@/lib/shiftCoverage";

describe("shiftCoverage", () => {
  it("builds rows with baseline requirements for each shift", () => {
    const rows = buildShiftCoverageRows({
      startDate: "2026-02-16",
      endDate: "2026-02-16",
      events: [],
      forecasts: [],
      assignments: [],
    });

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.shift === "morning")?.required).toBe(2);
    expect(rows.find((row) => row.shift === "afternoon")?.required).toBe(2);
    expect(rows.find((row) => row.shift === "night")?.required).toBe(1);
  });

  it("increases morning requirements based on breakfast forecasts", () => {
    const rows = buildShiftCoverageRows({
      startDate: "2026-02-16",
      endDate: "2026-02-16",
      events: [],
      forecasts: [{ forecast_date: "2026-02-16", breakfast_pax: 280 }],
      assignments: [],
    });

    const morning = rows.find((row) => row.shift === "morning");
    expect(morning?.required).toBeGreaterThan(2);
  });

  it("calculates critical deficits when events overload a shift", () => {
    const rows = buildShiftCoverageRows({
      startDate: "2026-02-16",
      endDate: "2026-02-16",
      events: [
        {
          event_date: "2026-02-16",
          event_time: "20:30",
          status: "confirmed",
          pax: 320,
          pax_estimated: 320,
          pax_confirmed: 300,
        },
      ],
      forecasts: [],
      assignments: [{ shift_date: "2026-02-16", shift_type: "night" }],
    });

    const night = rows.find((row) => row.shift === "night");
    expect(night?.severity).toBe("critical");
    expect((night?.deficit ?? 0) > 0).toBe(true);
  });

  it("groups rows by date", () => {
    const rows = buildShiftCoverageRows({
      startDate: "2026-02-16",
      endDate: "2026-02-17",
      events: [],
      forecasts: [],
      assignments: [],
    });

    const grouped = getCoverageRowsByDate(rows);
    expect(grouped.get("2026-02-16")?.length).toBe(3);
    expect(grouped.get("2026-02-17")?.length).toBe(3);
  });
});
