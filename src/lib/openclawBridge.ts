const DEFAULT_BASE_DELAY_MS = 5_000;
const DEFAULT_MAX_DELAY_MS = 300_000;

export function calculateRetryDelayMs(
  nextAttempt: number,
  options?: { baseDelayMs?: number; maxDelayMs?: number },
): number {
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const exponent = Math.max(0, nextAttempt - 1);
  return Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
}

export function buildRetryUpdate(input: {
  currentAttemptCount: number;
  maxAttempts?: number;
  now?: Date;
  baseDelayMs?: number;
  maxDelayMs?: number;
}) {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? 6;
  const nextAttemptCount = input.currentAttemptCount + 1;
  const exhausted = nextAttemptCount >= maxAttempts;
  const delayMs = calculateRetryDelayMs(nextAttemptCount, {
    baseDelayMs: input.baseDelayMs,
    maxDelayMs: input.maxDelayMs,
  });
  const nextRetryAt = new Date(now.getTime() + delayMs);

  return {
    attemptCount: nextAttemptCount,
    exhausted,
    delayMs,
    nextRetryAt,
  };
}

export function registerIdempotentEvent(
  eventId: string,
  processedEventIds: Set<string>,
): { isDuplicate: boolean; normalizedEventId: string } {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) {
    throw new Error("event_id is required");
  }

  if (processedEventIds.has(normalizedEventId)) {
    return { isDuplicate: true, normalizedEventId };
  }

  processedEventIds.add(normalizedEventId);
  return { isDuplicate: false, normalizedEventId };
}
