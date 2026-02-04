type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractGeminiTextFromGenerateContent(data: unknown): string {
  if (!isRecord(data)) return "";
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const first = candidates[0];
  if (!isRecord(first)) return "";
  const content = isRecord(first.content) ? first.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];

  return parts
    .map((p) => (isRecord(p) && typeof p.text === "string" ? p.text : ""))
    .join("");
}

export function extractFirstJsonObject(text: string): JsonValue {
  const clean = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in model response");
  }

  return JSON.parse(match[0]) as JsonValue;
}
