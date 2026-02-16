const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toLowerHex(input: ArrayBuffer): string {
  return bytesToHex(new Uint8Array(input));
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toLowerHex(signature);
}

export function isTimestampWithinWindow(
  timestampSeconds: string,
  maxSkewSeconds = 300,
): boolean {
  const ts = Number(timestampSeconds);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - ts) <= maxSkewSeconds;
}

export function buildOpenClawCanonical(input: {
  timestampSeconds: string;
  body: string;
}): string {
  return `${input.timestampSeconds}.${input.body}`;
}

export function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
