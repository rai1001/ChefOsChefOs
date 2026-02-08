export type ShiftType = "morning" | "afternoon" | "night";

export interface PlannerTask {
  id: string;
  title: string;
  shift: ShiftType;
  priority: "high" | "medium" | "low";
  durationMinutes: number;
  dependsOn?: string[];
  serviceWindow?: "pre_service" | "service" | "post_service";
}

export interface PlannerEvent {
  id: string;
  name: string;
  pax: number;
  shift: ShiftType;
}

export interface ShiftCapacity {
  staffId: string;
  shift: ShiftType;
  capacityMinutes: number;
}

export interface PlannedTask {
  taskId: string;
  title: string;
  shift: ShiftType;
  assignedTo: string | null;
  durationMinutes: number;
}

export interface DailyPlan {
  tasks: PlannedTask[];
  unplannedTaskIds: string[];
}

function priorityScore(task: PlannerTask): number {
  if (task.serviceWindow === "pre_service") return 100;
  if (task.priority === "high") return 80;
  if (task.priority === "medium") return 50;
  return 20;
}

export function buildDailyPlan(input: {
  tasks: PlannerTask[];
  events: PlannerEvent[];
  capacities: ShiftCapacity[];
}): DailyPlan {
  const tasks = [...input.tasks];
  const completed = new Set<string>();
  const remaining = new Map<string, number>();

  for (const c of input.capacities) {
    remaining.set(c.staffId, (remaining.get(c.staffId) ?? 0) + c.capacityMinutes);
  }

  // Add deterministic prep workload from events.
  for (const event of input.events) {
    tasks.push({
      id: `event-prep:${event.id}`,
      title: `Prep ${event.name}`,
      shift: event.shift,
      priority: "high",
      durationMinutes: Math.max(Math.round(event.pax * 0.5), 30),
      serviceWindow: "pre_service",
    });
  }

  const sorted = tasks.sort((a, b) => priorityScore(b) - priorityScore(a));
  const planned: PlannedTask[] = [];
  const unplannedTaskIds: string[] = [];

  for (const task of sorted) {
    const deps = task.dependsOn ?? [];
    if (!deps.every((id) => completed.has(id))) {
      unplannedTaskIds.push(task.id);
      continue;
    }

    const candidates = input.capacities.filter((c) => c.shift === task.shift);
    const assignee = candidates.find((c) => (remaining.get(c.staffId) ?? 0) >= task.durationMinutes);

    if (!assignee) {
      unplannedTaskIds.push(task.id);
      continue;
    }

    remaining.set(assignee.staffId, (remaining.get(assignee.staffId) ?? 0) - task.durationMinutes);
    planned.push({
      taskId: task.id,
      title: task.title,
      shift: task.shift,
      assignedTo: assignee.staffId,
      durationMinutes: task.durationMinutes,
    });
    completed.add(task.id);
  }

  return { tasks: planned, unplannedTaskIds };
}
