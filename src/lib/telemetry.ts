export interface TelemetryEvent {
  hotelId: string;
  entity: string;
  action: string;
  payload?: unknown;
  actorUserId?: string | null;
}

export interface OpsAuditInsert {
  hotel_id: string;
  entity: string;
  action: string;
  payload: Record<string, unknown>;
  actor_user_id?: string | null;
}

function safeJson(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) return { value };
  return value as Record<string, unknown>;
}

export function truncatePayload(
  payload: Record<string, unknown>,
  maxLength: number = 8000,
): Record<string, unknown> {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= maxLength) return payload;
  return {
    _truncated: true,
    _size: serialized.length,
    preview: serialized.slice(0, maxLength),
  };
}

export function buildOpsAuditInsert(event: TelemetryEvent): OpsAuditInsert {
  return {
    hotel_id: event.hotelId,
    entity: event.entity,
    action: event.action,
    payload: truncatePayload(safeJson(event.payload)),
    actor_user_id: event.actorUserId ?? null,
  };
}
