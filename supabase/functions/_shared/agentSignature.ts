const textEncoder = new TextEncoder();

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(body));
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

export function isTimestampWithinWindow(
  timestamp: string,
  maxSkewSeconds: number = 60,
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts * 1000) <= maxSkewSeconds * 1000;
}

export async function verifyEd25519Signature(input: {
  canonical: string;
  signatureBase64: string;
  publicKeyBase64: string;
}): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    fromBase64(input.publicKeyBase64),
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    fromBase64(input.signatureBase64),
    textEncoder.encode(input.canonical),
  );
}

export function hasScope(scopes: string[] | null | undefined, requiredScope: string): boolean {
  return (scopes ?? []).includes(requiredScope);
}
