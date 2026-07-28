import type {
  AgentExecutionPolicySnapshot,
  AgentPolicyDetail,
  AgentPolicyStatus,
  AgentPolicySummary,
} from "./AgentPolicyTypes";

type AgentPolicyRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  dailyBudgetUSDC: number;
  remainingBudgetUSDC: number;
  maxPurchaseUSDC: number;
  minimumScore: number;
  manualApprovalRequired: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  archivedAt: Date | string | null;
};

export function toAgentPolicySummary(
  policy: AgentPolicyRow,
  isDefault: boolean,
): AgentPolicySummary {
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    status: normalizePolicyStatus(policy.status),
    isDefault,
    version: policy.version,
    dailyBudgetUSDC: formatUSDCString(policy.dailyBudgetUSDC),
    remainingBudgetUSDC: formatUSDCString(policy.remainingBudgetUSDC),
    maxPurchaseUSDC: formatUSDCString(policy.maxPurchaseUSDC),
    minimumScore: policy.minimumScore,
    manualApprovalRequired: true,
    expiresAt: toIsoOrNull(policy.expiresAt),
    createdAt: toIsoString(policy.createdAt),
    updatedAt: toIsoString(policy.updatedAt),
    archivedAt: toIsoOrNull(policy.archivedAt),
  };
}

export function toAgentPolicyDetail(
  policy: AgentPolicyRow,
  isDefault: boolean,
): AgentPolicyDetail {
  return toAgentPolicySummary(policy, isDefault);
}

export function toAgentExecutionPolicySnapshot(
  policy: AgentPolicySummary | AgentPolicyDetail,
  overridesApplied: readonly string[] = [],
  overrides: AgentExecutionPolicySnapshot["overrides"] = {},
): AgentExecutionPolicySnapshot {
  const dailyBudgetUSDC = Number(policy.dailyBudgetUSDC);
  const remainingBudgetUSDC = Number(policy.remainingBudgetUSDC);
  const maxPurchaseUSDC = Number(policy.maxPurchaseUSDC);
  const minimumMatchScore = policy.minimumScore;

  return {
    policyId: policy.id,
    policyName: policy.name,
    policyStatus: policy.status,
    policyVersion: policy.version,
    policyDescription: policy.description,
    isDefault: policy.isDefault,
    dailyBudgetUSDC: Number.isFinite(dailyBudgetUSDC) ? dailyBudgetUSDC : null,
    remainingBudgetUSDC: Number.isFinite(remainingBudgetUSDC) ? remainingBudgetUSDC : 0,
    maxPurchaseUSDC: Number.isFinite(maxPurchaseUSDC) ? maxPurchaseUSDC : 0,
    minimumMatchScore,
    minimumScore: minimumMatchScore,
    manualApprovalRequired: true,
    expiresAt: policy.expiresAt,
    overridesApplied: [...overridesApplied],
    overrides,
  };
}

export function normalizePolicyStatus(value: string): AgentPolicyStatus {
  return value === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
}

function formatUSDCString(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const fixed = value.toFixed(6);
  return fixed.replace(/\.?0+$/, "");
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toIsoOrNull(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return toIsoString(value);
}

