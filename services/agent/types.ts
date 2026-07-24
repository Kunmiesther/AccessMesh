export type AgentDecision = "BUY" | "SKIP";

export type AgentGoalPlan = {
  originalGoal: string;
  normalizedQuery: string;
  keywords: string[];
  maximumPriceUSDC?: number;
};

export type AgentBudgetPolicy = {
  remainingBudgetUSDC: number;
  maxPurchaseUSDC: number;
  minimumMatchScore: number;
};

export type AgentResourceCandidate = {
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
  aiReasoning: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type CandidateEvaluation = {
  resource: AgentResourceCandidate;
  matchScore: number;
  matchedKeywords: string[];
  budgetEligible: boolean;
  reasons: string[];
};

export type AgentRuntimeResult = {
  goal: AgentGoalPlan;
  decision: AgentDecision;
  selectedResource: AgentResourceCandidate | null;
  selectedEvaluation: CandidateEvaluation | null;
  candidates: CandidateEvaluation[];
  trace: Array<{
    step: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    message: string;
  }>;
};
