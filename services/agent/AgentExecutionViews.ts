import type {
  AgentExecutionDetailView,
  AgentExecutionRecord,
  AgentExecutionSummary,
  SerializableCandidateComparisonSummary,
  SerializableCandidateEvaluationSnapshot,
  SerializableExecutionReasoning,
  SerializableGoalSnapshot,
  SerializablePolicySnapshot,
  SerializableResourceSnapshot,
  SerializableTraceEntry,
} from "./AgentExecutionTypes";
type ExecutionReasoning = SerializableExecutionReasoning;

export function buildAgentExecutionSummary(
  execution: AgentExecutionRecord,
): AgentExecutionSummary {
  const reasoning = getExecutionReasoning(execution.reasoning);
  const purchase = reasoning?.purchase ?? null;
  const failure = reasoning?.failure ?? null;
  const selectedResource = reasoning?.selectedResource ?? null;
  const updatedAt = execution.completedAt ?? execution.startedAt;

  return {
    id: execution.id,
    goal: extractGoalLabel(reasoning, execution.goal),
    status: normalizeStatus(execution.status),
    decision: execution.decision,
    selectedResourceId: execution.selectedResourceId,
    selectedResourceTitle: selectedResource?.title ?? null,
    estimatedCostUSDC: execution.estimatedCostUSDC,
    txHash: execution.txHash,
    createdAt: execution.startedAt,
    updatedAt,
    completedAt: execution.completedAt,
    failureCode: failure?.code ?? null,
    failureStage: failure?.stage ?? null,
    purchaseStatus: purchase?.status ?? "NOT_STARTED",
    settlementStatus: purchase?.settlementStatus ?? "NOT_STARTED",
    unlockStatus: purchase?.unlockStatus ?? "NOT_STARTED",
  };
}

export function buildAgentExecutionDetailView(
  execution: AgentExecutionRecord,
): AgentExecutionDetailView {
  const reasoning = getExecutionReasoning(execution.reasoning);
  const purchase = reasoning?.purchase ?? null;
  const failure = reasoning?.failure ?? null;
  const updatedAt = execution.completedAt ?? execution.startedAt;

  return {
    id: execution.id,
    agentId: execution.agentId,
    status: normalizeStatus(execution.status),
    decision: execution.decision,
    goal: reasoning?.goal ?? null,
    policy: reasoning?.policy ?? null,
    normalizedGoal: reasoning?.normalizedGoal ?? null,
    candidateCount: reasoning?.candidateCount ?? 0,
    comparisonSummary: reasoning?.comparisonSummary ?? null,
    selectedResource: reasoning?.selectedResource ?? null,
    selectedEvaluation: reasoning?.selectedEvaluation ?? null,
    candidates: reasoning?.candidateSummaries ?? [],
    trace: reasoning?.trace ?? [],
    purchase: purchase
      ? {
          status: purchase.status,
          amountUSDC: purchase.amountUSDC,
          transactionId: purchase.transactionId,
          resourceId: purchase.resourceId,
          settlementStatus: purchase.settlementStatus,
          unlockStatus: purchase.unlockStatus,
        }
      : null,
    failure: failure
      ? {
          code: failure.code,
          message: failure.message,
          stage: failure.stage ?? null,
        }
      : null,
    estimatedCostUSDC: execution.estimatedCostUSDC,
    txHash: execution.txHash,
    startedAt: execution.startedAt,
    createdAt: execution.startedAt,
    updatedAt,
    completedAt: execution.completedAt,
  };
}

export function buildExecutionTimelineEntries(
  execution: AgentExecutionDetailView,
) {
  const events: Array<{
    key: string;
    label: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED" | "CURRENT" | "COMPLETE";
    timestamp: string | null;
    message: string;
  }> = [];

  events.push({
    key: "created",
    label: "Execution created",
    status: "COMPLETE",
    timestamp: execution.createdAt,
    message: "The execution record was created.",
  });

  if (execution.status !== "CREATED") {
    events.push({
      key: "running",
      label: "Agent started",
      status: execution.status === "FAILED" ? "FAILED" : "COMPLETE",
      timestamp: execution.createdAt,
      message: "The agent began evaluating marketplace resources.",
    });
  }

  if (execution.candidateCount > 0) {
    events.push({
      key: "evaluated",
      label: "Marketplace evaluated",
      status: "COMPLETE",
      timestamp: execution.createdAt,
      message: `${execution.candidateCount} candidate(s) were evaluated.`,
    });
  }

  if (execution.status === "RECOMMENDED_SKIP") {
    events.push({
      key: "skip",
      label: "SKIP recommended",
      status: "SKIPPED",
      timestamp: execution.createdAt,
      message: "No purchase was recommended.",
    });
  } else if (execution.status !== "CREATED" && execution.decision === "BUY") {
    events.push({
      key: "buy",
      label: "BUY recommended",
      status: "COMPLETE",
      timestamp: execution.createdAt,
      message: "A resource met the goal and policy requirements.",
    });
  }

  if (execution.purchase?.status === "AWAITING_APPROVAL" || execution.status !== "CREATED") {
    events.push({
      key: "approval",
      label: "Approval requested",
      status: execution.purchase?.status === "AWAITING_APPROVAL" ? "CURRENT" : "COMPLETE",
      timestamp: execution.createdAt,
      message: "The purchase is waiting for owner confirmation.",
    });
  }

  if (execution.purchase?.status === "SUBMITTED" || execution.status === "PAYMENT_SUBMITTED" || execution.status === "VERIFYING_SETTLEMENT" || execution.status === "UNLOCKING" || execution.status === "COMPLETED") {
    events.push({
      key: "payment",
      label: "Payment submitted",
      status: execution.status === "PAYMENT_SUBMITTED" ? "CURRENT" : "COMPLETE",
      timestamp: execution.createdAt,
      message: "The Arc payment was submitted.",
    });
  }

  if (execution.status === "VERIFYING_SETTLEMENT" || execution.status === "UNLOCKING" || execution.status === "COMPLETED") {
    events.push({
      key: "settlement",
      label: "Settlement verification started",
      status: execution.status === "VERIFYING_SETTLEMENT" ? "CURRENT" : "COMPLETE",
      timestamp: execution.createdAt,
      message: "AccessMesh is verifying the payment settlement.",
    });
  }

  if (execution.status === "UNLOCKING" || execution.status === "COMPLETED") {
    events.push({
      key: "unlocking",
      label: "Unlock started",
      status: execution.status === "UNLOCKING" ? "CURRENT" : "COMPLETE",
      timestamp: execution.createdAt,
      message: "Settlement was verified and access is being unlocked.",
    });
  }

  if (execution.status === "COMPLETED") {
    events.push({
      key: "completed",
      label: "Execution completed",
      status: "SUCCESS",
      timestamp: execution.completedAt ?? execution.updatedAt,
      message: "The purchase and unlock were completed.",
    });
  }

  if (execution.status === "FAILED" && execution.failure) {
    events.push({
      key: "failed",
      label: "Execution failed",
      status: "FAILED",
      timestamp: execution.completedAt ?? execution.updatedAt,
      message: execution.failure.message,
    });
  }

  for (const traceEntry of execution.trace) {
    events.push({
      key: `trace-${traceEntry.step}-${traceEntry.status}`,
      label: traceEntry.step.replace(/_/g, " "),
      status:
        traceEntry.status === "FAILED"
          ? "FAILED"
          : traceEntry.status === "SKIPPED"
            ? "SKIPPED"
            : "COMPLETE",
      timestamp: execution.createdAt,
      message: traceEntry.message,
    });
  }

  return events;
}

function getExecutionReasoning(
  reasoning: SerializableExecutionReasoning | null,
) {
  if (!reasoning || reasoning.version !== 1) {
    return null;
  }

  return reasoning;
}

function extractGoalLabel(
  reasoning: SerializableExecutionReasoning | null,
  fallbackGoal: string,
) {
  return reasoning?.goal.originalGoal?.trim() || fallbackGoal;
}

function normalizeStatus(status: string) {
  return status as AgentExecutionSummary["status"];
}
