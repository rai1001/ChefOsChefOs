import { describe, expect, test } from "vitest";
import {
  dedupeNormalizedEvents,
  extractPaxFromText,
  inferEventTypeFromName,
  normalizeEventInsert,
  normalizeEventStatus,
} from "./eventNormalization";

describe("eventNormalization", () => {
  test("normalizes lifecycle status to roadmap values", () => {
    expect(normalizeEventStatus("borrador")).toBe("draft");
    expect(normalizeEventStatus("CONFIRMADO")).toBe("confirmed");
    expect(normalizeEventStatus("cancelado")).toBe("cancelled");
  });

  test("infers event type from event name", () => {
    expect(inferEventTypeFromName("Boda Garcia Lopez")).toBe("wedding");
    expect(inferEventTypeFromName("Congreso Medicina 2026")).toBe("conference");
    expect(inferEventTypeFromName("Desayuno VIP")).toBe("breakfast");
  });

  test("extracts estimated/confirmed pax from text tokens", () => {
    expect(extractPaxFromText("Cena empresa CONF 90 EST 120")).toEqual({
      estimated: 120,
      confirmed: 90,
    });
    expect(extractPaxFromText("Boda 80/120 pax")).toEqual({
      estimated: 120,
      confirmed: 80,
    });
  });

  test("normalizes and dedupes imported rows", () => {
    const rowA = normalizeEventInsert({
      name: "Boda Perez 120 pax",
      event_date: "2026-06-20",
      status: "confirmado",
      pax: 120,
      venue_id: "venue-1",
    });
    const rowB = normalizeEventInsert({
      name: "boda perez conf 130 est 150",
      event_date: "2026-06-20",
      status: "confirmed",
      venue_id: "venue-1",
    });
    const rowC = normalizeEventInsert({
      name: "Conferencia Tech",
      event_date: "2026-06-21",
      status: "draft",
      pax_estimated: 200,
      venue_id: "venue-2",
    });

    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();
    expect(rowC).not.toBeNull();

    const deduped = dedupeNormalizedEvents([rowA!, rowB!, rowC!]);
    expect(deduped.rows).toHaveLength(2);
    expect(deduped.duplicates).toBe(1);
    expect(deduped.rows[0].pax_confirmed).toBe(130);
  });
});
