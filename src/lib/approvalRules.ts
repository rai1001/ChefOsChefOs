export type ApprovalEntity = "purchase" | "menu";

export interface ApprovalPolicy {
  id?: string;
  entity: ApprovalEntity;
  thresholdAmount: number;
  requiredRole: string;
  active?: boolean;
}

export interface ApprovalDecision {
  requiresApproval: boolean;
  requiredRole?: string;
  thresholdAmount?: number;
}

export function resolveApprovalRequirement(
  policies: ApprovalPolicy[],
  entity: ApprovalEntity,
  amount: number,
): ApprovalDecision {
  const active = policies
    .filter((policy) => policy.entity === entity && policy.active !== false)
    .sort((a, b) => b.thresholdAmount - a.thresholdAmount);

  const match = active.find((policy) => amount >= policy.thresholdAmount);
  if (!match) return { requiresApproval: false };

  return {
    requiresApproval: true,
    requiredRole: match.requiredRole,
    thresholdAmount: match.thresholdAmount,
  };
}
