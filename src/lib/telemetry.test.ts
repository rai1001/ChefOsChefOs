import { describe, expect, test } from "vitest";
import { buildOpsAuditInsert, truncatePayload } from "./telemetry";

describe("telemetry", () => {
  test("builds insert payload with safe defaults", () => {
    const insert = buildOpsAuditInsert({
      hotelId: "hotel-1",
      entity: "purchase",
      action: "create",
    });

    expect(insert.hotel_id).toBe("hotel-1");
    expect(insert.payload).toEqual({});
  });

  test("truncates oversized payload", () => {
    const payload = { huge: "x".repeat(9000) };
    const out = truncatePayload(payload, 2000);
    expect(out._truncated).toBe(true);
  });
});
