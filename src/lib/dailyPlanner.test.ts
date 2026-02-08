import { describe, expect, test } from "vitest";
import { buildDailyPlan } from "./dailyPlanner";

describe("dailyPlanner", () => {
  test("prioritizes pre-service and high-priority tasks", () => {
    const plan = buildDailyPlan({
      tasks: [
        { id: "t-low", title: "Low", shift: "morning", priority: "low", durationMinutes: 30 },
        { id: "t-high", title: "High", shift: "morning", priority: "high", durationMinutes: 30 },
      ],
      events: [],
      capacities: [{ staffId: "s1", shift: "morning", capacityMinutes: 60 }],
    });

    expect(plan.tasks[0].taskId).toBe("t-high");
  });

  test("enforces task dependencies", () => {
    const plan = buildDailyPlan({
      tasks: [
        { id: "prep", title: "Prep", shift: "morning", priority: "high", durationMinutes: 30 },
        {
          id: "cook",
          title: "Cook",
          shift: "morning",
          priority: "high",
          durationMinutes: 30,
          dependsOn: ["prep"],
        },
      ],
      events: [],
      capacities: [{ staffId: "s1", shift: "morning", capacityMinutes: 30 }],
    });

    expect(plan.tasks.find((task) => task.taskId === "prep")).toBeTruthy();
    expect(plan.unplannedTaskIds).toContain("cook");
  });

  test("respects shift capacity", () => {
    const plan = buildDailyPlan({
      tasks: [{ id: "t1", title: "Task", shift: "night", priority: "medium", durationMinutes: 120 }],
      events: [],
      capacities: [{ staffId: "s1", shift: "night", capacityMinutes: 60 }],
    });
    expect(plan.tasks).toHaveLength(0);
    expect(plan.unplannedTaskIds).toContain("t1");
  });
});
