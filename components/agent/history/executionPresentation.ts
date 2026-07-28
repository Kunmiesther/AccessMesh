import type {
  AgentExecutionStatus,
  AgentRecommendationDecision,
} from "@/services/agent/AgentExecutionTypes";

export type ExecutionTone = "neutral" | "info" | "positive" | "warning" | "danger";

export const EXECUTION_STATUS_PRESENTATION: Record<
  AgentExecutionStatus,
  {
    label: string;
    description: string;
    tone: ExecutionTone;
  }
> = {
  CREATED: {
    label: "Created",
    description: "The execution was created.",
    tone: "neutral",
  },
  RUNNING: {
    label: "Running",
    description: "The agent is evaluating marketplace resources.",
    tone: "info",
  },
  RECOMMENDED_BUY: {
    label: "Buy recommended",
    description: "A resource met the goal and policy requirements.",
    tone: "positive",
  },
  RECOMMENDED_SKIP: {
    label: "Skipped",
    description: "No purchase was recommended.",
    tone: "warning",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting approval",
    description: "The purchase is waiting for owner confirmation.",
    tone: "info",
  },
  PAYMENT_SUBMITTED: {
    label: "Payment submitted",
    description: "The Arc payment was submitted.",
    tone: "info",
  },
  VERIFYING_SETTLEMENT: {
    label: "Verifying settlement",
    description: "AccessMesh is verifying the payment settlement.",
    tone: "info",
  },
  UNLOCKING: {
    label: "Unlocking",
    description: "Settlement is verified and access is being unlocked.",
    tone: "info",
  },
  COMPLETED: {
    label: "Completed",
    description: "The purchase and unlock were completed.",
    tone: "positive",
  },
  FAILED: {
    label: "Failed",
    description: "The execution could not complete.",
    tone: "danger",
  },
};

export const EXECUTION_DECISION_PRESENTATION: Record<
  AgentRecommendationDecision,
  {
    label: string;
    tone: ExecutionTone;
  }
> = {
  BUY: {
    label: "BUY",
    tone: "positive",
  },
  SKIP: {
    label: "SKIP",
    tone: "warning",
  },
};

export function getExecutionStatusPresentation(status: AgentExecutionStatus) {
  return EXECUTION_STATUS_PRESENTATION[status];
}

export function getExecutionDecisionPresentation(
  decision: AgentRecommendationDecision | null,
) {
  return decision ? EXECUTION_DECISION_PRESENTATION[decision] : null;
}
