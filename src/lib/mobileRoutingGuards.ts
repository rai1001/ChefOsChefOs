export type QuickActionId =
  | "new_task"
  | "receive_purchase"
  | "record_waste"
  | "start_task"
  | "complete_task";

export interface QuickActionGuardInput {
  isMobile: boolean;
  hasHotel: boolean;
  role: string;
}

const ALLOWED_ROLES_BY_ACTION: Record<QuickActionId, string[]> = {
  new_task: ["admin", "jefe_cocina"],
  receive_purchase: ["admin", "jefe_cocina", "produccion"],
  record_waste: ["admin", "jefe_cocina", "produccion"],
  start_task: ["admin", "jefe_cocina", "produccion"],
  complete_task: ["admin", "jefe_cocina", "produccion"],
};

export function canUseQuickAction(
  action: QuickActionId,
  input: QuickActionGuardInput,
): boolean {
  if (!input.isMobile) return false;
  if (!input.hasHotel) return false;
  return ALLOWED_ROLES_BY_ACTION[action].includes(input.role);
}
