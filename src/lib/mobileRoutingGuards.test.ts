import { describe, expect, test } from "vitest";
import { canUseQuickAction } from "./mobileRoutingGuards";

describe("mobileRoutingGuards", () => {
  test("allows quick action only on mobile with role and hotel", () => {
    expect(
      canUseQuickAction("record_waste", {
        isMobile: true,
        hasHotel: true,
        role: "produccion",
      }),
    ).toBe(true);

    expect(
      canUseQuickAction("record_waste", {
        isMobile: false,
        hasHotel: true,
        role: "produccion",
      }),
    ).toBe(false);
  });
});
