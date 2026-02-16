export const TICKET_CATEGORIES = [
  "bug",
  "soporte",
  "incidente",
  "mejora",
  "operacion",
] as const;

export const TICKET_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const TICKET_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;

export const TICKET_STATUSES = [
  "received",
  "triaged",
  "in_progress",
  "blocked",
  "fixed",
  "needs_human",
  "closed",
] as const;

export const TICKET_SOURCES = ["web", "mobile", "api", "operations"] as const;

export const OUTBOUND_TICKET_EVENTS = [
  "ticket.created",
  "ticket.updated",
  "ticket.escalated",
] as const;

export const CALLBACK_TICKET_EVENTS = [
  "ticket.triaged",
  "ticket.analysis_ready",
  "ticket.solution_proposed",
  "ticket.resolved",
  "ticket.needs_human",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketSource = (typeof TICKET_SOURCES)[number];
export type OutboundTicketEvent = (typeof OUTBOUND_TICKET_EVENTS)[number];
export type CallbackTicketEvent = (typeof CALLBACK_TICKET_EVENTS)[number];

export interface TicketAttachment {
  name: string;
  url: string;
  size: number | null;
  contentType: string | null;
}

export interface TicketRecordLike {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  requester_id: string | null;
  requester_name: string;
  assignee_user_id: string | null;
  hotel_id: string;
  attachments: TicketAttachment[];
  metadata: Record<string, unknown>;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutboundTicketEnvelope {
  event_id: string;
  event_type: OutboundTicketEvent;
  occurred_at: string;
  ticket: TicketRecordLike;
}

export interface OpenClawCallbackPayload {
  event_id: string;
  event_type: CallbackTicketEvent;
  ticket_id?: string;
  ticket_uuid?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

function compactWhitespace(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl = (code >= 0 && code <= 31) || code === 127;
    if (!isControl || char === "\n" || char === "\r" || char === "\t") {
      out += char;
    }
  }
  return out.trim();
}

export function sanitizeTicketText(value: string, maxLength: number) {
  const sanitized = compactWhitespace(value);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength);
}

export function sanitizeTicketAttachments(input: unknown): TicketAttachment[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = sanitizeTicketText(String(row.name ?? "adjunto"), 120);
      const url = sanitizeTicketText(String(row.url ?? ""), 500);
      if (!url) return null;
      const size = Number.isFinite(Number(row.size)) ? Math.max(0, Number(row.size)) : null;
      const contentTypeRaw = row.contentType ?? row.content_type ?? null;
      const contentType =
        typeof contentTypeRaw === "string" && contentTypeRaw.length > 0
          ? sanitizeTicketText(contentTypeRaw, 120)
          : null;
      return { name, url, size, contentType } satisfies TicketAttachment;
    })
    .filter((item): item is TicketAttachment => item !== null)
    .slice(0, 10);
}

export function sanitizeTicketMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const safeKey = sanitizeTicketText(key, 80);
    if (!safeKey) continue;

    if (value === null) {
      output[safeKey] = null;
      continue;
    }

    if (["string", "number", "boolean"].includes(typeof value)) {
      output[safeKey] =
        typeof value === "string" ? sanitizeTicketText(value, 500) : value;
      continue;
    }

    if (Array.isArray(value)) {
      output[safeKey] = value
        .slice(0, 20)
        .map((entry) =>
          ["string", "number", "boolean"].includes(typeof entry)
            ? typeof entry === "string"
              ? sanitizeTicketText(entry, 200)
              : entry
            : null,
        );
      continue;
    }

    output[safeKey] = "[object]";
  }
  return output;
}

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTicketSeverity(value: string): value is TicketSeverity {
  return (TICKET_SEVERITIES as readonly string[]).includes(value);
}

export function isTicketPriority(value: string): value is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function isTicketCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function isTicketSource(value: string): value is TicketSource {
  return (TICKET_SOURCES as readonly string[]).includes(value);
}

export function isOutboundTicketEvent(value: string): value is OutboundTicketEvent {
  return (OUTBOUND_TICKET_EVENTS as readonly string[]).includes(value);
}

export function isCallbackTicketEvent(value: string): value is CallbackTicketEvent {
  return (CALLBACK_TICKET_EVENTS as readonly string[]).includes(value);
}

export function mapCallbackEventToStatus(eventType: CallbackTicketEvent): TicketStatus {
  if (eventType === "ticket.triaged") return "triaged";
  if (eventType === "ticket.analysis_ready") return "in_progress";
  if (eventType === "ticket.solution_proposed") return "fixed";
  if (eventType === "ticket.resolved") return "closed";
  return "needs_human";
}

export function shouldEmitEscalation(input: {
  previousSeverity: TicketSeverity;
  nextSeverity: TicketSeverity;
  previousPriority: TicketPriority;
  nextPriority: TicketPriority;
  previousStatus: TicketStatus;
  nextStatus: TicketStatus;
}): boolean {
  return (
    (input.previousSeverity !== "critical" && input.nextSeverity === "critical") ||
    (input.previousPriority !== "P1" && input.nextPriority === "P1") ||
    (input.previousStatus !== "needs_human" && input.nextStatus === "needs_human")
  );
}

export function buildOutboundTicketEnvelope(input: {
  eventId: string;
  eventType: OutboundTicketEvent;
  occurredAt?: string;
  ticket: TicketRecordLike;
}): OutboundTicketEnvelope {
  return {
    event_id: sanitizeTicketText(input.eventId, 120),
    event_type: input.eventType,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    ticket: {
      ...input.ticket,
      title: sanitizeTicketText(input.ticket.title, 240),
      description: sanitizeTicketText(input.ticket.description, 8000),
      requester_name: sanitizeTicketText(input.ticket.requester_name, 120),
      attachments: sanitizeTicketAttachments(input.ticket.attachments),
      metadata: sanitizeTicketMetadata(input.ticket.metadata),
    },
  };
}

export function validateOutboundTicketEnvelope(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be object" };
  }

  const row = payload as Record<string, unknown>;
  if (!isOutboundTicketEvent(String(row.event_type ?? ""))) {
    return { ok: false, error: "unsupported outbound event_type" };
  }

  const ticket = row.ticket;
  if (!ticket || typeof ticket !== "object") {
    return { ok: false, error: "ticket is required" };
  }

  const candidate = ticket as Record<string, unknown>;
  if (!isTicketStatus(String(candidate.status ?? ""))) {
    return { ok: false, error: "invalid ticket status" };
  }
  if (!isTicketSeverity(String(candidate.severity ?? ""))) {
    return { ok: false, error: "invalid ticket severity" };
  }
  if (!isTicketPriority(String(candidate.priority ?? ""))) {
    return { ok: false, error: "invalid ticket priority" };
  }
  if (!isTicketCategory(String(candidate.category ?? ""))) {
    return { ok: false, error: "invalid ticket category" };
  }

  if (!String(candidate.title ?? "").trim()) {
    return { ok: false, error: "title is required" };
  }
  if (!String(candidate.ticket_id ?? "").trim()) {
    return { ok: false, error: "ticket_id is required" };
  }

  return { ok: true };
}

export function validateCallbackPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be object" };
  }

  const row = payload as Record<string, unknown>;
  const eventId = String(row.event_id ?? "").trim();
  if (!eventId) {
    return { ok: false, error: "event_id is required" };
  }

  const eventType = String(row.event_type ?? "").trim();
  if (!isCallbackTicketEvent(eventType)) {
    return { ok: false, error: "unsupported callback event_type" };
  }

  const ticketId = String(row.ticket_id ?? "").trim();
  const ticketUuid = String(row.ticket_uuid ?? "").trim();
  if (!ticketId && !ticketUuid) {
    return { ok: false, error: "ticket_id or ticket_uuid is required" };
  }

  return { ok: true };
}

export function applyOpenClawCallbackToTicket(
  ticket: TicketRecordLike,
  payload: OpenClawCallbackPayload,
): TicketRecordLike {
  const nextStatus = mapCallbackEventToStatus(payload.event_type);
  const mergedMetadata = {
    ...ticket.metadata,
    openclaw_last_event_id: payload.event_id,
    openclaw_last_event_type: payload.event_type,
    openclaw_last_event_at: new Date().toISOString(),
    ...(payload.metadata ?? {}),
  };

  return {
    ...ticket,
    status: nextStatus,
    metadata: sanitizeTicketMetadata(mergedMetadata),
    updated_at: new Date().toISOString(),
  };
}
