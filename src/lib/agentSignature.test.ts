import { describe, expect, test } from "vitest";
import {
  NonceReplayGuard,
  createCanonicalString,
  hasScope,
  isTimestampWithinWindow,
  sha256Hex,
  signCanonicalString,
  verifyCanonicalString,
} from "./agentSignature";

function toBase64(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer)).toString("base64");
}

describe("agentSignature", () => {
  test("validates a correct ed25519 signature", async () => {
    const keys = await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    );

    const privatePkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
    const publicRaw = await crypto.subtle.exportKey("raw", keys.publicKey);

    const bodyHash = await sha256Hex({ ok: true });
    const canonical = createCanonicalString({
      method: "POST",
      path: "/functions/v1/agent-bridge/tasks/complete",
      query: "",
      bodyHash,
      timestamp: "1760000000",
      nonce: "nonce-1",
      agentId: "agent-123",
    });

    const signature = await signCanonicalString(canonical, toBase64(privatePkcs8));
    const valid = await verifyCanonicalString(canonical, signature, toBase64(publicRaw));
    expect(valid).toBe(true);
  });

  test("rejects expired timestamp", () => {
    const now = new Date("2026-02-07T12:00:00.000Z").getTime();
    const oldTs = String(Math.floor(new Date("2026-02-07T11:57:30.000Z").getTime() / 1000));
    expect(isTimestampWithinWindow(oldTs, { nowMs: now, maxSkewSeconds: 60 })).toBe(false);
  });

  test("detects nonce replay", () => {
    const guard = new NonceReplayGuard(60_000);
    expect(guard.consume("abc", 1000)).toBe(true);
    expect(guard.consume("abc", 1500)).toBe(false);
  });

  test("checks scope authorization", () => {
    expect(hasScope(["read:events", "read:tasks"], "write:tasks")).toBe(false);
    expect(hasScope(["read:events", "read:tasks"], "read:tasks")).toBe(true);
  });
});
