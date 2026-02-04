import { describe, expect, test } from "vitest";
import { dbShiftToUi, makeShiftKey, uiShiftToDb } from "./staffShiftAssignments";

describe("staffShiftAssignments helpers", () => {
  test("maps DB shift <-> UI shift", () => {
    expect(dbShiftToUi("morning")).toBe("M");
    expect(dbShiftToUi("afternoon")).toBe("T");
    expect(dbShiftToUi("night")).toBe("N");
    expect(dbShiftToUi("off")).toBe(null);

    expect(uiShiftToDb("M")).toBe("morning");
    expect(uiShiftToDb("T")).toBe("afternoon");
    expect(uiShiftToDb("N")).toBe("night");
    expect(uiShiftToDb(null)).toBe(null);
  });

  test("builds stable map keys", () => {
    expect(makeShiftKey("staff-1", "2026-02-04")).toBe("staff-1|2026-02-04");
  });
});

