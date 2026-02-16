const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number) {
  const expDelay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
  const jitter = Math.round(Math.random() * 120);
  return expDelay + jitter;
}

function getMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === "object" && "method" in input && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (error instanceof Error && error.name === "AbortError");
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  config?: RetryConfig,
) {
  const maxAttempts = config?.maxAttempts ?? 3;
  const baseDelayMs = config?.baseDelayMs ?? 300;
  const maxDelayMs = config?.maxDelayMs ?? 2400;
  const method = getMethod(input, init);
  const canRetry = RETRYABLE_METHODS.has(method);

  if (!canRetry || maxAttempts <= 1) {
    return fetch(input, init);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const shouldRetry =
        attempt < maxAttempts - 1 && RETRYABLE_STATUS.has(response.status);

      if (!shouldRetry) return response;
    } catch (error) {
      const shouldRetry = attempt < maxAttempts - 1 && !isAbortError(error);
      if (!shouldRetry) throw error;
    }

    await sleep(getBackoffDelay(attempt, baseDelayMs, maxDelayMs));
  }

  return fetch(input, init);
}

export function shouldRetryQueryError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500")
  );
}
