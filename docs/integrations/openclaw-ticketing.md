# OpenClaw Ticketing Integration (ChefOs)

## Scope
ChefOs implementa ticketing completo en producto y expone bridge de integracion con OpenClaw para eventos de tickets.

- Salida ChefOs -> OpenClaw: `ticket.created`, `ticket.updated`, `ticket.escalated`
- Entrada OpenClaw -> ChefOs: `ticket.triaged`, `ticket.analysis_ready`, `ticket.solution_proposed`, `ticket.resolved`, `ticket.needs_human`

## Endpoints

### 1) Outbound Dispatcher (ChefOs -> OpenClaw)
- Endpoint: `POST /functions/v1/openclaw-ticket-dispatch`
- Auth: JWT Supabase (`verify_jwt=true`)
- Uso: procesa cola outbox y emite eventos pendientes al webhook de OpenClaw.

Request body:
```json
{
  "hotel_id": "uuid-opcional",
  "max_batch": 20
}
```

Response:
```json
{
  "success": true,
  "request_id": "uuid",
  "processed": 12,
  "sent": 11,
  "failed": 1,
  "ignored": 0
}
```

### 2) Inbound Callback (OpenClaw -> ChefOs)
- Endpoint: `POST /functions/v1/openclaw-ticket-callback`
- Auth: HMAC (`verify_jwt=false`)
- Uso: recibe callback de analisis/resolucion desde OpenClaw.

Required headers:
- `x-openclaw-ts`: unix timestamp (segundos)
- `x-openclaw-signature`: HMAC SHA-256 hex de `"{ts}.{rawBody}"`
- `x-openclaw-event-id`: opcional (fallback si no viene en body)
- `x-openclaw-request-id`: opcional

Request body:
```json
{
  "event_id": "ocw_evt_20260216_001",
  "event_type": "ticket.triaged",
  "ticket_id": "TKT-00000042",
  "ticket_uuid": "uuid-opcional",
  "hotel_id": "uuid-opcional",
  "note": "Severidad validada por agente",
  "metadata": {
    "model": "openclaw-v3",
    "confidence": 0.92
  }
}
```

Response:
```json
{
  "success": true,
  "request_id": "uuid",
  "event_id": "ocw_evt_20260216_001",
  "ticket_id": "TKT-00000042",
  "status": "triaged"
}
```

## Event Contract

### Outbound envelope (ChefOs -> OpenClaw)
```json
{
  "event_id": "toe_...",
  "event_type": "ticket.created",
  "occurred_at": "2026-02-16T22:11:52.123Z",
  "source": "chefos",
  "ticket": {
    "ticket_id": "TKT-00000042",
    "ticket_uuid": "uuid",
    "title": "Error al cerrar tarea",
    "description": "No permite cerrar tarea desde movil",
    "category": "bug",
    "severity": "high",
    "priority": "P2",
    "status": "received",
    "source": "web",
    "requester_id": "uuid",
    "requester_name": "Ana",
    "assignee_user_id": null,
    "hotel_id": "uuid",
    "attachments": [],
    "metadata": {
      "appVersion": "1.0.7",
      "platform": "web",
      "locale": "es-ES"
    },
    "first_response_at": null,
    "resolved_at": null,
    "created_at": "2026-02-16T22:11:50.000Z",
    "updated_at": "2026-02-16T22:11:50.000Z"
  }
}
```

### Callback events (OpenClaw -> ChefOs)
Allowed `event_type`:
- `ticket.triaged` -> status `triaged`
- `ticket.analysis_ready` -> status `in_progress`
- `ticket.solution_proposed` -> status `fixed`
- `ticket.resolved` -> status `closed`
- `ticket.needs_human` -> status `needs_human`

## Security

### Secrets (server-side only)
- `OPENCLAW_TICKETS_WEBHOOK_URL`
- `OPENCLAW_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

### Signature rules
- Canonical string: `"{timestampSeconds}.{rawBody}"`
- Algorithm: HMAC SHA-256
- Encoding: lowercase hex
- Allowed clock skew: 300s

## Idempotency / Retry

### Idempotency
- Inbound dedupe por `event_id` en `support_ticket_inbox` (`UNIQUE(event_id)`).
- Si llega un `event_id` duplicado, se responde `200` con `duplicate=true` y no se reprocesa.

### Outbound retry
- Cola: `support_ticket_outbox`
- Backoff exponencial: `5s * 2^(attempt-1)`, max `300s`
- Estado final: `failed` al superar `max_attempts`

## Observability

### Structured logs
Tabla: `support_ticket_bridge_logs`

Campos clave:
- `request_id`
- `ticket_id`
- `event_id`
- `event_type`
- `direction` (`inbound` / `outbound`)
- `latency_ms`
- `retries`
- `result` (`success` / `error` / `ignored`)
- `http_status`

### Health indicator
View: `support_ticket_bridge_health_view`

Estados:
- `up`
- `degraded`
- `down`

Se muestra en:
- `Tickets` (badge bridge)
- `Operations` (card "Bridge tickets OpenClaw")

## Error Catalog

- `400 invalid_json_body`
- `400 event_id is required`
- `400 unsupported event_type`
- `400 ticket_id or ticket_uuid is required`
- `401 missing_hmac_headers`
- `401 invalid_signature`
- `401 timestamp_outside_window`
- `404 ticket_not_found`
- `500 openclaw_webhook_not_configured`
- `500 internal_error`

## Operational Notes

- El ticketing core vive en ChefOs (`support_tickets`, `support_ticket_events`).
- OpenClaw solo orquesta por eventos; no se ejecuta logica de agentes dentro de ChefOs.
- Para pruebas locales, se puede invocar manualmente:
  - `openclaw-ticket-dispatch` para vaciar outbox
  - `openclaw-ticket-callback` con firma valida para simular callbacks
