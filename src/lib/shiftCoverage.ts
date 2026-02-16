import { eachDayOfInterval, format, parseISO } from "date-fns";

export type CoverageShift = "morning" | "afternoon" | "night";
export type CoverageSeverity = "ok" | "low" | "medium" | "critical";

export interface CoverageEventInput {
  event_date: string;
  event_time: string | null;
  status: string | null;
  pax: number | null;
  pax_estimated: number | null;
  pax_confirmed: number | null;
}

export interface CoverageForecastInput {
  forecast_date: string;
  breakfast_pax: number | null;
}

export interface CoverageAssignmentInput {
  shift_date: string;
  shift_type: string;
}

export interface ShiftCoverageRow {
  key: string;
  date: string;
  shift: CoverageShift;
  required: number;
  assigned: number;
  deficit: number;
  severity: CoverageSeverity;
}

const SHIFTS: CoverageShift[] = ["morning", "afternoon", "night"];

const BASE_REQUIRED_BY_SHIFT: Record<CoverageShift, number> = {
  morning: 2,
  afternoon: 2,
  night: 1,
};

const EVENT_PAX_PER_STAFF: Record<CoverageShift, number> = {
  morning: 120,
  afternoon: 120,
  night: 90,
};

function toNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}

function normalizeShiftType(value: string | null | undefined): CoverageShift | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "morning" || normalized === "m") return "morning";
  if (normalized === "afternoon" || normalized === "evening" || normalized === "t") return "afternoon";
  if (normalized === "night" || normalized === "n") return "night";
  return null;
}

function normalizeShiftFromEventTime(timeValue: string | null | undefined): CoverageShift {
  if (!timeValue) return "afternoon";
  const hours = Number(timeValue.slice(0, 2));
  if (!Number.isFinite(hours)) return "afternoon";
  if (hours < 12) return "morning";
  if (hours < 19) return "afternoon";
  return "night";
}

function getEventDemandPax(event: CoverageEventInput) {
  const status = (event.status ?? "").toLowerCase();
  if (status === "cancelled") return 0;
  const estimated = Math.max(toNumber(event.pax_estimated), toNumber(event.pax));
  const confirmed = toNumber(event.pax_confirmed);
  if (status === "draft") return Math.round(estimated * 0.7);
  return Math.max(estimated, confirmed);
}

function getSeverityFromDeficit(deficit: number): CoverageSeverity {
  if (deficit <= 0) return "ok";
  if (deficit === 1) return "low";
  if (deficit === 2) return "medium";
  return "critical";
}

export function buildShiftCoverageRows(input: {
  startDate: string;
  endDate: string;
  events: CoverageEventInput[];
  forecasts: CoverageForecastInput[];
  assignments: CoverageAssignmentInput[];
}): ShiftCoverageRow[] {
  const start = parseISO(input.startDate);
  const end = parseISO(input.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const requiredByKey = new Map<string, number>();
  const assignedByKey = new Map<string, number>();

  for (const day of eachDayOfInterval({ start, end })) {
    const date = format(day, "yyyy-MM-dd");
    for (const shift of SHIFTS) {
      requiredByKey.set(`${date}::${shift}`, BASE_REQUIRED_BY_SHIFT[shift]);
      assignedByKey.set(`${date}::${shift}`, 0);
    }
  }

  for (const forecast of input.forecasts) {
    const key = `${forecast.forecast_date}::morning`;
    if (!requiredByKey.has(key)) continue;
    const breakfast = Math.max(0, toNumber(forecast.breakfast_pax));
    const extra = breakfast > 120 ? Math.ceil((breakfast - 120) / 80) : 0;
    requiredByKey.set(key, (requiredByKey.get(key) ?? BASE_REQUIRED_BY_SHIFT.morning) + extra);
  }

  for (const event of input.events) {
    const shift = normalizeShiftFromEventTime(event.event_time);
    const key = `${event.event_date}::${shift}`;
    if (!requiredByKey.has(key)) continue;

    const demandPax = getEventDemandPax(event);
    if (demandPax <= 0) continue;

    const extra = Math.ceil(demandPax / EVENT_PAX_PER_STAFF[shift]);
    requiredByKey.set(key, (requiredByKey.get(key) ?? BASE_REQUIRED_BY_SHIFT[shift]) + extra);
  }

  for (const assignment of input.assignments) {
    const shift = normalizeShiftType(assignment.shift_type);
    if (!shift) continue;

    const key = `${assignment.shift_date}::${shift}`;
    if (!assignedByKey.has(key)) continue;

    assignedByKey.set(key, (assignedByKey.get(key) ?? 0) + 1);
  }

  const rows: ShiftCoverageRow[] = [];

  for (const [key, required] of requiredByKey.entries()) {
    const [date, shiftRaw] = key.split("::");
    const shift = shiftRaw as CoverageShift;
    const assigned = assignedByKey.get(key) ?? 0;
    const deficit = Math.max(0, required - assigned);

    rows.push({
      key,
      date,
      shift,
      required,
      assigned,
      deficit,
      severity: getSeverityFromDeficit(deficit),
    });
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift);
  });
}

export function getCoverageRowsByDate(rows: ShiftCoverageRow[]) {
  const map = new Map<string, ShiftCoverageRow[]>();
  for (const row of rows) {
    const current = map.get(row.date) ?? [];
    current.push(row);
    map.set(row.date, current);
  }
  return map;
}
