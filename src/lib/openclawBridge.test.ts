import {
  buildRetryUpdate,
  calculateRetryDelayMs,
  registerIdempotentEvent,
} from "@/lib/openclawBridge";

describe("openclawBridge retry/idempotency", () => {
  it("calculates exponential backoff capped at max delay", () => {
    expect(calculateRetryDelayMs(1, { baseDelayMs: 1_000, maxDelayMs: 60_000 })).toBe(1_000);
    expect(calculateRetryDelayMs(2, { baseDelayMs: 1_000, maxDelayMs: 60_000 })).toBe(2_000);
    expect(calculateRetryDelayMs(3, { baseDelayMs: 1_000, maxDelayMs: 60_000 })).toBe(4_000);
    expect(calculateRetryDelayMs(10, { baseDelayMs: 1_000, maxDelayMs: 60_000 })).toBe(60_000);
  });

  it("builds retry state and marks exhaustion at max attempts", () => {
    const now = new Date("2026-02-16T20:00:00.000Z");

    const first = buildRetryUpdate({
      currentAttemptCount: 0,
      maxAttempts: 3,
      now,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
    });

    expect(first.attemptCount).toBe(1);
    expect(first.exhausted).toBe(false);
    expect(first.delayMs).toBe(2_000);

    const last = buildRetryUpdate({
      currentAttemptCount: 2,
      maxAttempts: 3,
      now,
      baseDelayMs: 2_000,
      maxDelayMs: 30_000,
    });

    expect(last.attemptCount).toBe(3);
    expect(last.exhausted).toBe(true);
  });

  it("deduplicates by event_id for idempotent processing", () => {
    const processed = new Set<string>();

    const first = registerIdempotentEvent("evt_123", processed);
    const second = registerIdempotentEvent("evt_123", processed);

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(() => registerIdempotentEvent("   ", processed)).toThrow("event_id is required");
  });
});
