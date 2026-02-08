const textEncoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(body: unknown): Promise<string> {
  const payload =
    typeof body === "string" ? body : JSON.stringify(body ?? {});
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(payload));
  return bytesToHex(new Uint8Array(digest));
}

export function canonicalizeQuery(query: string): string {
  if (!query) return "";
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  return [...params.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function createCanonicalString(input: {
  method: string;
  path: string;
  query: string;
  bodyHash: string;
  timestamp: string;
  nonce: string;
  agentId: string;
}): string {
  return [
    input.method.toUpperCase(),
    input.path,
    canonicalizeQuery(input.query),
    input.bodyHash,
    input.timestamp,
    input.nonce,
    input.agentId,
  ].join("\n");
}

export async function signCanonicalString(
  canonical: string,
  privateKeyPkcs8Base64: string,
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(privateKeyPkcs8Base64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    textEncoder.encode(canonical),
  );
  return toBase64(new Uint8Array(signature));
}

export async function verifyCanonicalString(
  canonical: string,
  signatureBase64: string,
  publicKeyRawBase64: string,
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(publicKeyRawBase64),
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    fromBase64(signatureBase64),
    textEncoder.encode(canonical),
  );
}

export function isTimestampWithinWindow(
  timestamp: string,
  options?: { nowMs?: number; maxSkewSeconds?: number },
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  const maxSkewSeconds = options?.maxSkewSeconds ?? 60;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const tsMs = timestampNumber * 1000;
  return Math.abs(nowMs - tsMs) <= maxSkewSeconds * 1000;
}

export function hasScope(allowedScopes: string[], requiredScope: string): boolean {
  return allowedScopes.includes(requiredScope);
}

export class NonceReplayGuard {
  private readonly nonces = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 60_000) {
    this.ttlMs = ttlMs;
  }

  consume(nonce: string, nowMs: number = Date.now()): boolean {
    this.cleanup(nowMs);
    if (this.nonces.has(nonce)) return false;
    this.nonces.set(nonce, nowMs + this.ttlMs);
    return true;
  }

  private cleanup(nowMs: number): void {
    for (const [nonce, expiry] of this.nonces.entries()) {
      if (expiry <= nowMs) this.nonces.delete(nonce);
    }
  }
}
