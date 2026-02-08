#!/usr/bin/env node

import crypto from "node:crypto";

function canonicalizeQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    })
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function buildCanonicalString({
  method,
  path,
  query,
  bodyHash,
  timestamp,
  nonce,
  agentId,
}) {
  return [
    method.toUpperCase(),
    path,
    query,
    bodyHash,
    timestamp,
    nonce,
    agentId,
  ].join("\n");
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/clawtbot-agent-bridge-smoke.mjs [route] [method] [bodyJson]",
      "",
      "Example:",
      "  node scripts/clawtbot-agent-bridge-smoke.mjs /functions/v1/agent-bridge/events GET",
      '  node scripts/clawtbot-agent-bridge-smoke.mjs /functions/v1/agent-bridge/tasks/complete POST \'{"taskId":"uuid"}\'',
      "",
      "Required env vars:",
      "  SUPABASE_URL",
      "  CLAWTBOT_AGENT_ID",
      "  CLAWTBOT_PRIVATE_KEY_PKCS8_BASE64",
      "",
      "Optional env vars:",
      "  CHECK_REPLAY=1  (send second request with same nonce/signature, expects 409)",
    ].join("\n"),
  );
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function ensureBodyString(method, bodyArg) {
  if (!bodyArg) return "";
  if (method === "GET" || method === "HEAD") {
    throw new Error("GET/HEAD requests must not include bodyJson");
  }
  try {
    return JSON.stringify(JSON.parse(bodyArg));
  } catch {
    throw new Error("bodyJson must be valid JSON");
  }
}

function buildSignedHeaders(input) {
  const privateKeyDer = Buffer.from(input.privateKeyPkcs8Base64, "base64");
  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto
    .sign(null, Buffer.from(input.canonical, "utf8"), privateKey)
    .toString("base64");

  const headers = {
    "x-agent-id": input.agentId,
    "x-agent-ts": input.timestamp,
    "x-agent-nonce": input.nonce,
    "x-agent-signature": signature,
  };

  if (input.bodyRaw) headers["content-type"] = "application/json";
  return headers;
}

async function sendSignedRequest({ url, method, bodyRaw, headers }) {
  const response = await fetch(url, {
    method,
    headers,
    body: bodyRaw || undefined,
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { response, parsed };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const route = process.argv[2] ?? "/functions/v1/agent-bridge/events";
  const method = (process.argv[3] ?? "GET").toUpperCase();
  const bodyArg = process.argv[4] ?? "";

  const supabaseUrl = readRequiredEnv("SUPABASE_URL");
  const agentId = readRequiredEnv("CLAWTBOT_AGENT_ID");
  const privateKeyPkcs8Base64 = readRequiredEnv(
    "CLAWTBOT_PRIVATE_KEY_PKCS8_BASE64",
  );

  const url = route.startsWith("http")
    ? new URL(route)
    : new URL(route, supabaseUrl);
  const bodyRaw = ensureBodyString(method, bodyArg);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256Hex(bodyRaw);
  const canonical = buildCanonicalString({
    method,
    path: url.pathname,
    query: canonicalizeQuery(url.searchParams),
    bodyHash,
    timestamp,
    nonce,
    agentId,
  });

  const signedHeaders = buildSignedHeaders({
    canonical,
    agentId,
    timestamp,
    nonce,
    privateKeyPkcs8Base64,
    bodyRaw,
  });

  console.log(`Request URL: ${url.toString()}`);
  console.log(`Method: ${method}`);
  console.log(`Agent: ${agentId}`);
  console.log(`Nonce: ${nonce}`);

  const first = await sendSignedRequest({
    url,
    method,
    bodyRaw,
    headers: signedHeaders,
  });

  console.log(`Status: ${first.response.status}`);
  console.log("Response:");
  console.log(JSON.stringify(first.parsed, null, 2));

  if (process.env.CHECK_REPLAY === "1") {
    const second = await sendSignedRequest({
      url,
      method,
      bodyRaw,
      headers: signedHeaders,
    });
    console.log(`Replay status: ${second.response.status}`);
    console.log("Replay response:");
    console.log(JSON.stringify(second.parsed, null, 2));
  }

  if (!first.response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  printUsage();
  process.exit(1);
});
