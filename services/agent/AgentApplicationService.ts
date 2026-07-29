import { InputError } from "@/lib/validation";
import { runAgentRuntime } from "@/services/agent/AgentRuntime";
import { listAgentMarketplaceCandidates } from "@/services/agent/AgentMarketplaceService";
import { AgentNotificationRepository } from "./AgentNotificationRepository";
import type {
  AgentBudgetPolicy,
  AgentRuntimeResult,
  AgentResourceCandidate,
} from "@/services/agent/types";
import type { CandidateEvaluation } from "@/services/agent/types";
import {
  buildCandidateComparisonSummary,
  toSerializableCandidateEvaluationSnapshot,
  toSerializableResourceSnapshot,
} from "./AgentExecutionSerialization";
import type { AgentExecutionRepository } from "./AgentExecutionRepository";
import type {
  AgentExecutionRecord,
  SerializableGoalSnapshot,
  SerializablePolicySnapshot,
  SerializableTraceEntry,
} from "./AgentExecutionTypes";

export type AgentApplicationInput = {
  goal: string;
  policy: AgentBudgetPolicy;
  policySnapshot?: SerializablePolicySnapshot;
  resourceLimit?: number;
};

export type AgentApplicationResult = AgentRuntimeResult & {
  executionId: string | null;
};

type AgentApplicationDeps = {
  loadCandidates?: typeof listAgentMarketplaceCandidates;
  runRuntime?: typeof runAgentRuntime;
  executionRepository?: AgentExecutionRepository;
  ownerId?: string | null;
};

export async function runAgentApplication(
  input: AgentApplicationInput,
  deps: AgentApplicationDeps = {},
): Promise<AgentApplicationResult> {
  const goal = normalizeGoal(input.goal);
  const policy = validatePolicy(input.policy);
  const loadCandidates = deps.loadCandidates ?? listAgentMarketplaceCandidates;
  const runRuntime = deps.runRuntime ?? runAgentRuntime;
  const persistence = deps.executionRepository && deps.ownerId
    ? {
        executionRepository: deps.executionRepository,
        ownerId: deps.ownerId,
      }
    : null;

  let executionId: string | null = null;

  try {
    const execution = persistence
      ? await createExecutionRecord(persistence.executionRepository, {
          ownerId: persistence.ownerId,
          goal: toSerializableGoalSnapshot(goal),
          policySnapshot: input.policySnapshot ?? toSerializablePolicySnapshot(policy),
          normalizedGoal: goal,
          candidateCount: 0,
          trace: [],
        }).catch((error) => {
          console.warn("agent execution persistence failed during create", {
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        })
      : null;

    executionId = execution?.id ?? null;

    if (executionId && persistence) {
      await persistence.executionRepository.markExecutionRunning(executionId).catch((error) => {
        console.warn("agent execution persistence failed during running state", {
          message: error instanceof Error ? error.message : String(error),
        });
        executionId = null;
      });
    }

    const resources = await loadCandidates({
      limit: input.resourceLimit,
    });

    const result = runRuntime({
      goal,
      policy,
      resources: resources.map(cloneCandidate),
    });

    if (executionId && persistence) {
      await persistence.executionRepository
        .recordRecommendation(executionId, {
          decision: result.decision,
          candidateCount: result.candidates.length,
          comparisonSummary: buildCandidateComparisonSummary({
            candidates: result.candidates,
            selectedResourceId: result.selectedResource?.id ?? null,
          }),
          candidateSummaries: result.candidates.map(toSerializableCandidateEvaluationSnapshot),
          selectedResource: result.selectedResource
            ? toSerializableResourceSnapshot(result.selectedResource)
            : null,
          selectedEvaluation: result.selectedEvaluation
            ? toSerializableCandidateEvaluationSnapshot(result.selectedEvaluation)
            : null,
          trace: result.trace as readonly SerializableTraceEntry[],
          estimatedCostUSDC: result.selectedResource?.priceUSDC ?? null,
        })
        .catch((error) => {
          console.warn("agent execution persistence failed during recommendation", {
            message: error instanceof Error ? error.message : String(error),
          });
          executionId = null;
        });
    }

    return {
      ...result,
      executionId,
    };
  } catch (error) {
    if (executionId && persistence) {
      await persistence.executionRepository.failExecution(executionId, {
        code: classifyAgentExecutionFailure(error),
        message: getSafeErrorMessage(error),
        stage: "RUNNING",
      }).catch((persistError) => {
        console.warn("agent execution persistence failed during failure recording", {
          message: persistError instanceof Error ? persistError.message : String(persistError),
        });
      });

      const notificationRepository = new AgentNotificationRepository();
      await notificationRepository.ensureNotification({
        ownerId: persistence.ownerId,
        type: "EXECUTION_FAILED",
        title: "Execution failed",
        message: "The agent execution could not be completed.",
        entityType: "execution",
        entityId: executionId,
        actionPath: `/agent/executions/${executionId}`,
        dedupeKey: `execution-failed:${executionId}`,
      }).catch((persistError) => {
        console.warn("agent execution persistence failed during failure notification", {
          message: persistError instanceof Error ? persistError.message : String(persistError),
        });
      });
    }

    throw error;
  }
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

  if (maxPurchaseUSDC < 0) {
    throw new InputError("policy.maxPurchaseUSDC must be 0 or greater");
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

async function createExecutionRecord(
  repository: AgentExecutionRepository,
  input: {
    ownerId: string;
    goal: SerializableGoalSnapshot;
    policySnapshot: SerializablePolicySnapshot;
    normalizedGoal: string;
    candidateCount: number;
    trace: readonly SerializableTraceEntry[];
  },
): Promise<AgentExecutionRecord> {
  return repository.createExecution(input);
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

function toSerializableGoalSnapshot(goal: string): SerializableGoalSnapshot {
  return {
    originalGoal: goal,
    normalizedQuery: goal.toLowerCase(),
    keywords: goal
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  };
}

function toSerializablePolicySnapshot(
  policy: AgentBudgetPolicy,
): SerializablePolicySnapshot {
  return {
    remainingBudgetUSDC: policy.remainingBudgetUSDC,
    maxPurchaseUSDC: policy.maxPurchaseUSDC,
    minimumMatchScore: policy.minimumMatchScore,
    minimumScore: policy.minimumMatchScore,
  };
}

function classifyAgentExecutionFailure(error: unknown) {
  const message = getSafeErrorMessage(error).toLowerCase();

  if (/marketplace|resource|candidate/.test(message)) {
    return "MARKETPLACE_FAILURE";
  }

  if (/runtime|recommendation|goal/.test(message)) {
    return "RUNTIME_FAILURE";
  }

  return "UNKNOWN_FAILURE";
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The agent execution could not be completed.";
}
