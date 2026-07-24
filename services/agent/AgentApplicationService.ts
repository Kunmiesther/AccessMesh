import { InputError } from "@/lib/validation";
import { runAgentRuntime } from "@/services/agent/AgentRuntime";
import { listAgentMarketplaceCandidates } from "@/services/agent/AgentMarketplaceService";
import type {
  AgentBudgetPolicy,
  AgentRuntimeResult,
} from "@/services/agent/types";
import type { AgentResourceCandidate } from "@/services/agent/types";

export type AgentApplicationInput = {
  goal: string;
  policy: AgentBudgetPolicy;
  resourceLimit?: number;
};

type AgentApplicationDeps = {
  loadCandidates?: typeof listAgentMarketplaceCandidates;
  runRuntime?: typeof runAgentRuntime;
};

export async function runAgentApplication(
  input: AgentApplicationInput,
  deps: AgentApplicationDeps = {},
): Promise<AgentRuntimeResult> {
  const goal = normalizeGoal(input.goal);
  const policy = validatePolicy(input.policy);
  const loadCandidates = deps.loadCandidates ?? listAgentMarketplaceCandidates;
  const runRuntime = deps.runRuntime ?? runAgentRuntime;
  const resources = await loadCandidates({
    limit: input.resourceLimit,
  });

  return runRuntime({
    goal,
    policy,
    resources: resources.map(cloneCandidate),
  });
}

function normalizeGoal(goal: string) {
  if (typeof goal !== "string" || goal.trim().length === 0) {
    throw new InputError("goal is required");
  }

  return goal.trim();
}

function validatePolicy(policy: AgentBudgetPolicy): AgentBudgetPolicy {
  if (!policy || typeof policy !== "object") {
    throw new InputError("policy is required");
  }

  const remainingBudgetUSDC = assertFiniteNumber(
    policy.remainingBudgetUSDC,
    "policy.remainingBudgetUSDC",
  );
  const maxPurchaseUSDC = assertFiniteNumber(
    policy.maxPurchaseUSDC,
    "policy.maxPurchaseUSDC",
  );
  const minimumMatchScore = assertFiniteNumber(
    policy.minimumMatchScore,
    "policy.minimumMatchScore",
  );

  if (remainingBudgetUSDC < 0) {
    throw new InputError("policy.remainingBudgetUSDC must be 0 or greater");
  }

  if (maxPurchaseUSDC <= 0) {
    throw new InputError("policy.maxPurchaseUSDC must be greater than 0");
  }

  if (minimumMatchScore < 0 || minimumMatchScore > 100) {
    throw new InputError("policy.minimumMatchScore must be between 0 and 100");
  }

  return {
    remainingBudgetUSDC,
    maxPurchaseUSDC,
    minimumMatchScore,
  };
}

function assertFiniteNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError(`${field} must be a number`);
  }

  return value;
}

function cloneCandidate(resource: AgentResourceCandidate): AgentResourceCandidate {
  return {
    ...resource,
    aiTopics: [...resource.aiTopics],
  };
}
