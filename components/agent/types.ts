import type {
  AgentBudgetPolicy,
  AgentDecision,
  AgentGoalPlan,
} from "@/services/agent/types";

export type AgentComposerFields = {
  goal: string;
  remainingBudgetUSDC: string;
  maxPurchaseUSDC: string;
  minimumMatchScore: string;
};

export type AgentComposerValidationResult =
  | {
      ok: true;
      errors: Partial<Record<keyof AgentComposerFields, string>>;
      policy: AgentBudgetPolicy;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof AgentComposerFields, string>>;
      policy: null;
    };

export type AgentResourceCandidateView = {
  id: string;
  title: string;
  description: string;
  priceUSDC: number;
  resourceType: string;
  aiSummary: string | null;
  aiTopics: string[];
  aiCategory: string | null;
  aiCollection: string | null;
  aiPlacement: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type AgentCandidateEvaluationView = {
  resource: AgentResourceCandidateView;
  matchScore: number;
  matchedKeywords: string[];
  budgetEligible: boolean;
  reasons: string[];
};

export type AgentRuntimeResultView = {
  goal: AgentGoalPlan;
  decision: AgentDecision;
  selectedResource: AgentResourceCandidateView | null;
  selectedEvaluation: AgentCandidateEvaluationView | null;
  candidates: AgentCandidateEvaluationView[];
  trace: Array<{
    step: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    message: string;
  }>;
};

export type AgentRunApiSuccess = {
  ok: true;
  result: AgentRuntimeResultView;
};

export type AgentRunApiError = {
  ok: false;
  error: string;
};

export type AgentRunApiResponse = AgentRunApiSuccess | AgentRunApiError;

export const AGENT_LOADING_STAGES = [
  "Understanding goal",
  "Searching marketplace",
  "Comparing resources",
  "Checking budget policy",
  "Preparing recommendation",
] as const;

export const DEFAULT_AGENT_FORM: AgentComposerFields = {
  goal: "",
  remainingBudgetUSDC: "1",
  maxPurchaseUSDC: "0.25",
  minimumMatchScore: "35",
};

export const DEFAULT_AGENT_RESOURCE_LIMIT = 50;
