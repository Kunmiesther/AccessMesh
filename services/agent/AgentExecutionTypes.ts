import type {
  AgentBudgetPolicy,
  AgentDecision,
  AgentGoalPlan,
  AgentResourceCandidate,
  CandidateEvaluation,
} from "@/services/agent/types";

export type AgentExecutionStatus =
  | "CREATED"
  | "RUNNING"
  | "RECOMMENDED_BUY"
  | "RECOMMENDED_SKIP"
  | "AWAITING_APPROVAL"
  | "PAYMENT_SUBMITTED"
  | "VERIFYING_SETTLEMENT"
  | "UNLOCKING"
  | "COMPLETED"
  | "FAILED";

export type AgentRecommendationDecision = AgentDecision;

export type AgentPurchaseStatus =
  | "NOT_STARTED"
  | "AWAITING_APPROVAL"
  | "SUBMITTED"
  | "FAILED"
  | "COMPLETED";

export type AgentSettlementStatus =
  | "NOT_STARTED"
  | "VERIFYING"
  | "SETTLED"
  | "FAILED";

export type AgentUnlockStatus =
  | "NOT_STARTED"
  | "UNLOCKING"
  | "UNLOCKED"
  | "FAILED";

export type SerializablePolicySnapshot = Readonly<AgentBudgetPolicy>;

export type SerializableGoalSnapshot = Readonly<
  AgentGoalPlan & {
    originalGoal: string;
    normalizedQuery: string;
    keywords: string[];
  }
>;

export type SerializableResourceSnapshot = Readonly<
  Pick<
    AgentResourceCandidate,
    | "id"
    | "title"
    | "description"
    | "priceUSDC"
    | "resourceType"
    | "aiSummary"
    | "aiTopics"
    | "aiCategory"
    | "aiCollection"
    | "aiPlacement"
    | "publishedAt"
    | "createdAt"
  >
>;

export type SerializableCandidateEvaluationSnapshot = Readonly<
  Pick<CandidateEvaluation, "matchScore" | "matchedKeywords" | "budgetEligible" | "reasons"> & {
    resource: SerializableResourceSnapshot;
  }
>;

export type SerializableTraceEntry = Readonly<{
  step: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  message: string;
}>;

export type SerializableCandidateComparisonSummary = Readonly<{
  candidateCount: number;
  budgetEligibleCount: number;
  selectedCandidateId: string | null;
  topMatchScore: number | null;
  summary: string;
}>;

export type SerializablePaymentMetadata = Readonly<{
  transactionId: string;
  amountUSDC: number;
  resourceId: string;
  resourceTitle: string;
}>;

export type SerializableSettlementMetadata = Readonly<{
  status: AgentSettlementStatus;
  transactionId: string | null;
}>;

export type SerializableUnlockMetadata = Readonly<{
  status: AgentUnlockStatus;
  transactionId: string | null;
  unlocked: boolean;
}>;

export type SerializableFailureMetadata = Readonly<{
  code: string;
  message: string;
  stage?: string;
}>;

export type SerializableExecutionReasoning = Readonly<{
  version: 1;
  goal: SerializableGoalSnapshot;
  policy: SerializablePolicySnapshot;
  normalizedGoal: string;
  candidateCount: number;
  candidateSummaries: SerializableCandidateEvaluationSnapshot[];
  selectedResource: SerializableResourceSnapshot | null;
  selectedEvaluation: SerializableCandidateEvaluationSnapshot | null;
  comparisonSummary: SerializableCandidateComparisonSummary;
  trace: SerializableTraceEntry[];
  recommendation: {
    decision: AgentRecommendationDecision;
    status: AgentExecutionStatus;
  };
  purchase: {
    status: AgentPurchaseStatus;
    settlementStatus: AgentSettlementStatus;
    unlockStatus: AgentUnlockStatus;
    transactionId: string | null;
    amountUSDC: number | null;
    resourceId: string | null;
  };
  failure: SerializableFailureMetadata | null;
}>;

export type AgentExecutionRecord = Readonly<{
  id: string;
  agentId: string;
  goal: string;
  status: AgentExecutionStatus | string;
  decision: AgentRecommendationDecision | null;
  selectedResourceId: string | null;
  reasoning: SerializableExecutionReasoning | null;
  estimatedCostUSDC: number | null;
  txHash: string | null;
  startedAt: string;
  completedAt: string | null;
}>;
