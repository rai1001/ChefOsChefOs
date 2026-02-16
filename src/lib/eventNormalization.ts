export const EVENT_TYPE_VALUES = [
  "breakfast",
  "banquet",
  "wedding",
  "corporate",
  "conference",
  "cocktail",
  "other",
] as const;

export const EVENT_STATUS_VALUES = ["draft", "confirmed", "cancelled"] as const;

export type EventTypeNormalized = (typeof EVENT_TYPE_VALUES)[number];
export type EventStatusNormalized = (typeof EVENT_STATUS_VALUES)[number];

export interface EventNormalizationInput {
  name: string;
  event_date: string;
  event_time?: string | null;
  venue_id?: string | null;
  status?: string | null;
  event_type?: string | null;
  pax?: number | null;
  pax_estimated?: number | null;
  pax_confirmed?: number | null;
  notes?: string | null;
}

export interface NormalizedEventInsert {
  name: string;
  event_date: string;
  event_time: string | null;
  venue_id: string | null;
  status: EventStatusNormalized;
  event_type: EventTypeNormalized;
  pax: number;
  pax_estimated: number;
  pax_confirmed: number;
  notes: string | null;
}

const EVENT_TYPE_ALIASES: Record<EventTypeNormalized, string[]> = {
  breakfast: ["desayuno", "breakfast", "brunch"],
  banquet: ["banquete", "banquet", "cena", "comida", "almuerzo"],
  wedding: ["boda", "wedding", "enlace"],
  corporate: ["corporativo", "corporate", "empresa", "meeting", "reunion"],
  conference: ["conferencia", "congreso", "seminario", "conference"],
  cocktail: ["cocktail", "coctel", "aperitivo"],
  other: [],
};

function canonicalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word;
      const lower = word.toLowerCase();
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeTime(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

function sanitizePax(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(Math.round(value), 0) : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 0) : 0;
  }
  return 0;
}

function cleanupImportTokens(rawName: string): string {
  return rawName
    .replace(/\b(?:cancelad[oa]|anulad[oa])\b/gi, "")
    .replace(/\b(?:conf(?:irmad[oa])?)\s*[:=-]?\s*\d+\b/gi, "")
    .replace(/\b(?:est(?:imad[oa])?)\s*[:=-]?\s*\d+\b/gi, "")
    .replace(/\b\d+\s*(?:pax|personas|comensales)\b/gi, "")
    .replace(/\((?:[^)]*pax[^)]*)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEventName(value: string): string {
  const cleaned = cleanupImportTokens(value ?? "");
  return toTitleCase(cleaned);
}

export function normalizeEventStatus(rawStatus?: string | null): EventStatusNormalized {
  const normalized = canonicalize(rawStatus ?? "");
  if (!normalized) return "draft";

  if (
    normalized.includes("cancel") ||
    normalized.includes("anulad") ||
    normalized.includes("caido") ||
    normalized === "no show"
  ) {
    return "cancelled";
  }

  if (
    normalized.includes("confirm") ||
    normalized.includes("cerrado") ||
    normalized.includes("activo") ||
    normalized.includes("in progress") ||
    normalized.includes("completed")
  ) {
    return "confirmed";
  }

  if (
    normalized.includes("draft") ||
    normalized.includes("borrador") ||
    normalized.includes("tentative") ||
    normalized.includes("provisional") ||
    normalized.includes("pendiente") ||
    normalized.includes("por confirmar")
  ) {
    return "draft";
  }

  if ((EVENT_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as EventStatusNormalized;
  }

  return "draft";
}

export function inferEventTypeFromName(name: string): EventTypeNormalized {
  const normalized = canonicalize(name);
  if (!normalized) return "other";

  for (const [eventType, aliases] of Object.entries(EVENT_TYPE_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return eventType as EventTypeNormalized;
    }
  }

  return "other";
}

export function normalizeEventType(rawType?: string | null, fallbackName?: string | null): EventTypeNormalized {
  const normalized = canonicalize(rawType ?? "");
  if (normalized) {
    for (const [eventType, aliases] of Object.entries(EVENT_TYPE_ALIASES)) {
      if (eventType === normalized || aliases.some((alias) => normalized.includes(alias))) {
        return eventType as EventTypeNormalized;
      }
    }
  }

  return inferEventTypeFromName(fallbackName ?? "");
}

export function extractPaxFromText(text: string): { estimated: number; confirmed: number } {
  const normalized = canonicalize(text);
  if (!normalized) return { estimated: 0, confirmed: 0 };

  const confirmedMatch = normalized.match(/\b(?:conf|confirmado|confirmed)\s*[:=-]?\s*(\d{1,5})\b/);
  const estimatedMatch = normalized.match(/\b(?:est|estimado|estimate|estimated)\s*[:=-]?\s*(\d{1,5})\b/);
  const slashMatch = normalized.match(/\b(\d{1,5})\s*\/\s*(\d{1,5})\b/);
  const paxMatch = normalized.match(/\b(\d{1,5})\s*(?:pax|personas|comensales)\b/);

  let estimated = estimatedMatch ? sanitizePax(estimatedMatch[1]) : 0;
  let confirmed = confirmedMatch ? sanitizePax(confirmedMatch[1]) : 0;

  if (slashMatch) {
    const first = sanitizePax(slashMatch[1]);
    const second = sanitizePax(slashMatch[2]);
    estimated = Math.max(estimated, Math.max(first, second));
    confirmed = Math.max(confirmed, Math.min(first, second));
  }

  if (paxMatch && !slashMatch) {
    const pax = sanitizePax(paxMatch[1]);
    estimated = Math.max(estimated, pax);
    confirmed = Math.max(confirmed, pax);
  }

  if (estimated > 0 && confirmed > estimated) {
    estimated = confirmed;
  }

  return { estimated, confirmed };
}

export function normalizeEventInsert(input: EventNormalizationInput): NormalizedEventInsert | null {
  const name = normalizeEventName(input.name);
  const eventDate = input.event_date?.trim();

  if (!name || !eventDate || !isValidIsoDate(eventDate)) return null;

  const status = normalizeEventStatus(input.status);
  const inferredType = normalizeEventType(input.event_type, name);
  const extractedPax = extractPaxFromText(`${input.name ?? ""} ${input.notes ?? ""}`);

  let estimated = Math.max(
    sanitizePax(input.pax_estimated),
    sanitizePax(input.pax),
    extractedPax.estimated,
  );
  let confirmed = Math.max(sanitizePax(input.pax_confirmed), extractedPax.confirmed);

  if (status === "confirmed" && confirmed === 0) {
    confirmed = Math.max(estimated, sanitizePax(input.pax));
  }
  if (status === "cancelled") {
    confirmed = 0;
  }
  if (estimated === 0 && confirmed > 0) {
    estimated = confirmed;
  }
  if (confirmed > estimated) {
    estimated = confirmed;
  }

  const pax = confirmed > 0 ? confirmed : estimated;

  return {
    name,
    event_date: eventDate,
    event_time: normalizeTime(input.event_time),
    venue_id: input.venue_id || null,
    status,
    event_type: inferredType,
    pax,
    pax_estimated: estimated,
    pax_confirmed: confirmed,
    notes: input.notes?.trim() || null,
  };
}

function buildDedupeKey(event: NormalizedEventInsert): string {
  return [
    event.event_date,
    event.venue_id ?? "no-venue",
    canonicalize(event.name),
  ].join("::");
}

export function dedupeNormalizedEvents(events: NormalizedEventInsert[]): {
  rows: NormalizedEventInsert[];
  duplicates: number;
} {
  const map = new Map<string, NormalizedEventInsert>();
  for (const event of events) {
    map.set(buildDedupeKey(event), event);
  }

  const rows = [...map.values()].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    if (a.event_time !== b.event_time) return (a.event_time ?? "").localeCompare(b.event_time ?? "");
    return a.name.localeCompare(b.name);
  });

  return {
    rows,
    duplicates: Math.max(events.length - rows.length, 0),
  };
}
