export type DbShiftType = "morning" | "afternoon" | "night" | "off";
export type UiShiftType = "M" | "T" | "N";

export function makeShiftKey(staffId: string, shiftDate: string) {
  return `${staffId}|${shiftDate}`;
}

export function dbShiftToUi(shift: DbShiftType | null): UiShiftType | null {
  if (!shift || shift === "off") return null;
  if (shift === "morning") return "M";
  if (shift === "afternoon") return "T";
  return "N";
}

export function uiShiftToDb(shift: UiShiftType | null): DbShiftType | null {
  if (!shift) return null;
  if (shift === "M") return "morning";
  if (shift === "T") return "afternoon";
  return "night";
}

