import { describe, expect, test } from "vitest";
import { resolveApprovalRequirement } from "./approvalRules";

describe("approvalRules", () => {
  test("applies threshold and role for purchase amount", () => {
    const decision = resolveApprovalRequirement(
      [
        { entity: "purchase", thresholdAmount: 500, requiredRole: "jefe_cocina" },
        { entity: "purchase", thresholdAmount: 1500, requiredRole: "admin" },
      ],
      "purchase",
      1700,
    );

    expect(decision.requiresApproval).toBe(true);
    expect(decision.requiredRole).toBe("admin");
  });

  test("returns no approval for low amount", () => {
    const decision = resolveApprovalRequirement(
      [{ entity: "menu", thresholdAmount: 300, requiredRole: "jefe_cocina" }],
      "menu",
      100,
    );

    expect(decision.requiresApproval).toBe(false);
  });
});
