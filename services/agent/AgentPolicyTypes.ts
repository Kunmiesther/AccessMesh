import type { AgentBudgetPolicy } from "./types";

export type AgentPolicyStatus = "ACTIVE" | "ARCHIVED";

export type AgentPolicyTemplateId =
  | "research-only"
  | "conservative-buyer"
  | "balanced-buyer";

export type AgentPolicyTemplateDefinition = Readonly<{
  id: AgentPolicyTemplateId;
  name: string;
  description: string;
  dailyBudgetUSDC: string;
  remainingBudgetUSDC: string;
  maxPurchaseUSDC: string;
  minimumScore: number;
  manualApprovalRequired: true;
}>;

export type AgentPolicyInput = {
  name: string;
  description?: string | null;
  dailyBudgetUSDC: string;
  remainingBudgetUSDC: string;
  maxPurchaseUSDC: string;
  minimumScore: string | number;
  expiresAt?: string | null;
  manualApprovalRequired?: boolean;
};

export type AgentPolicyUpdateInput = Partial<AgentPolicyInput> & {
  expectedVersion: number;
};

export type AgentPolicyRunOverrides = {
  remainingBudgetUSDC?: string | number | null;
  maxPurchaseUSDC?: string | number | null;
  minimumScore?: string | number | null;
};

export type AgentPolicySummary = Readonly<{
  id: string;
  name: string;
  description: string | null;
  status: AgentPolicyStatus;
  isDefault: boolean;
  version: number;
  dailyBudgetUSDC: string;
  remainingBudgetUSDC: string;
  maxPurchaseUSDC: string;
  minimumScore: number;
  manualApprovalRequired: true;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}>;

export type AgentPolicyDetail = AgentPolicySummary;

export type AgentExecutionPolicySnapshot = Readonly<
  AgentBudgetPolicy & {
    policyId: string | null;
    policyName: string | null;
    policyStatus: AgentPolicyStatus | "LEGACY";
    policyVersion: number | null;
    policyDescription: string | null;
    isDefault: boolean | null;
    dailyBudgetUSDC: number | null;
    minimumScore: number | null;
    manualApprovalRequired: boolean;
    expiresAt: string | null;
    overridesApplied: string[];
    overrides: Readonly<{
      remainingBudgetUSDC?: number | null;
      maxPurchaseUSDC?: number | null;
      minimumScore?: number | null;
    }>;
  }
>;

export const AGENT_POLICY_TEMPLATES: Record<
  AgentPolicyTemplateId,
  AgentPolicyTemplateDefinition
> = {
  "research-only": {
    id: "research-only",
    name: "Research Only",
    description: "Keep the agent in recommendation-only mode with no executable purchase budget.",
    dailyBudgetUSDC: "0",
    remainingBudgetUSDC: "0",
    maxPurchaseUSDC: "0",
    minimumScore: 75,
    manualApprovalRequired: true,
  },
  "conservative-buyer": {
    id: "conservative-buyer",
    name: "Conservative Buyer",
    description: "Small budget and a high threshold for cautious purchases.",
    dailyBudgetUSDC: "5",
    remainingBudgetUSDC: "5",
    maxPurchaseUSDC: "1",
    minimumScore: 85,
    manualApprovalRequired: true,
  },
  "balanced-buyer": {
    id: "balanced-buyer",
    name: "Balanced Buyer",
    description: "A general-purpose policy for normal research runs.",
    dailyBudgetUSDC: "20",
    remainingBudgetUSDC: "20",
    maxPurchaseUSDC: "4",
    minimumScore: 70,
    manualApprovalRequired: true,
  },
};
