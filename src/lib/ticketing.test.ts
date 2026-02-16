import {
  applyOpenClawCallbackToTicket,
  buildOutboundTicketEnvelope,
  mapCallbackEventToStatus,
  validateCallbackPayload,
  validateOutboundTicketEnvelope,
  type TicketRecordLike,
} from "@/lib/ticketing";

function sampleTicket(): TicketRecordLike {
  return {
    id: "9a1ff53d-76ab-4dcf-b601-e6e5c5d3c3f1",
    ticket_id: "TKT-00000042",
    title: "Error al cerrar tarea",
    description: "No permite cerrar una tarea desde movil.",
    category: "bug",
    severity: "high",
    priority: "P2",
    status: "received",
    source: "web",
    requester_id: "b0d3c2d4-a2b0-45de-9be5-9c9277ac9b0e",
    requester_name: "Ana",
    assignee_user_id: null,
    hotel_id: "f7e89df1-1822-4f9a-b24b-2b53ced8acdf",
    attachments: [],
    metadata: { appVersion: "1.0.0", platform: "web" },
    first_response_at: null,
    resolved_at: null,
    created_at: "2026-02-16T20:00:00.000Z",
    updated_at: "2026-02-16T20:00:00.000Z",
  };
}

describe("ticketing domain", () => {
  it("maps callback events to expected statuses", () => {
    expect(mapCallbackEventToStatus("ticket.triaged")).toBe("triaged");
    expect(mapCallbackEventToStatus("ticket.analysis_ready")).toBe("in_progress");
    expect(mapCallbackEventToStatus("ticket.solution_proposed")).toBe("fixed");
    expect(mapCallbackEventToStatus("ticket.resolved")).toBe("closed");
    expect(mapCallbackEventToStatus("ticket.needs_human")).toBe("needs_human");
  });

  it("validates outbound envelope payload shape", () => {
    const envelope = buildOutboundTicketEnvelope({
      eventId: "evt_1",
      eventType: "ticket.created",
      ticket: sampleTicket(),
    });

    expect(validateOutboundTicketEnvelope(envelope)).toEqual({ ok: true });
    expect(validateOutboundTicketEnvelope({ ...envelope, event_type: "ticket.invalid" })).toEqual({
      ok: false,
      error: "unsupported outbound event_type",
    });
  });

  it("validates callback payload and enforces id/ticket identity", () => {
    expect(
      validateCallbackPayload({
        event_id: "ocw_1",
        event_type: "ticket.triaged",
        ticket_id: "TKT-00000042",
      }),
    ).toEqual({ ok: true });

    expect(
      validateCallbackPayload({
        event_id: "",
        event_type: "ticket.triaged",
        ticket_id: "TKT-00000042",
      }),
    ).toEqual({ ok: false, error: "event_id is required" });

    expect(
      validateCallbackPayload({
        event_id: "ocw_2",
        event_type: "ticket.triaged",
      }),
    ).toEqual({ ok: false, error: "ticket_id or ticket_uuid is required" });
  });

  it("supports happy path create -> emit -> callback -> update", () => {
    const created = sampleTicket();
    const outbound = buildOutboundTicketEnvelope({
      eventId: "evt_happy",
      eventType: "ticket.created",
      ticket: created,
    });

    expect(outbound.ticket.status).toBe("received");
    expect(validateOutboundTicketEnvelope(outbound)).toEqual({ ok: true });

    const updated = applyOpenClawCallbackToTicket(created, {
      event_id: "ocw_happy",
      event_type: "ticket.triaged",
      ticket_id: created.ticket_id,
      metadata: { triage_reason: "missing_steps" },
    });

    expect(updated.status).toBe("triaged");
    expect(updated.metadata.openclaw_last_event_id).toBe("ocw_happy");
    expect(updated.metadata.triage_reason).toBe("missing_steps");
  });
});
