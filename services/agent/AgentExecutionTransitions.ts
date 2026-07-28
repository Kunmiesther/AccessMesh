import type { AgentExecutionStatus } from "./AgentExecutionTypes";

const ALLOWED_TRANSITIONS: Record<AgentExecutionStatus, readonly AgentExecutionStatus[]> = {
  CREATED: ["RUNNING", "FAILED"],
  RUNNING: ["RECOMMENDED_BUY", "RECOMMENDED_SKIP", "FAILED"],
  RECOMMENDED_BUY: ["AWAITING_APPROVAL", "FAILED"],
  RECOMMENDED_SKIP: [],
  AWAITING_APPROVAL: ["PAYMENT_SUBMITTED", "RECOMMENDED_BUY", "FAILED"],
  PAYMENT_SUBMITTED: ["VERIFYING_SETTLEMENT", "FAILED"],
  VERIFYING_SETTLEMENT: ["UNLOCKING", "FAILED"],
  UNLOCKING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

export function isTerminalAgentExecutionStatus(status: AgentExecutionStatus) {
  return status === "RECOMMENDED_SKIP" || status === "COMPLETED" || status === "FAILED";
}

export function validateAgentExecutionTransition(params: {
  from: AgentExecutionStatus;
  to: AgentExecutionStatus;
  idempotent?: boolean;
}) {
  const { from, to, idempotent = false } = params;

  if (from === to) {
    if (isTerminalAgentExecutionStatus(from) && !idempotent) {
      throw new Error(`Execution status ${from} is terminal and cannot be updated.`);
    }

    return;
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid execution status transition: ${from} -> ${to}`);
  }
}

export function getAllowedAgentExecutionTransitions(
  from: AgentExecutionStatus,
): readonly AgentExecutionStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
