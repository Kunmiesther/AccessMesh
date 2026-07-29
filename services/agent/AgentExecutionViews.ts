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
import type {
  AgentApprovalDetailView,
  AgentApprovalDecision,
  AgentApprovalSource,
  AgentApprovalStatus,
  AgentApprovalRejectionReason,
} from "./AgentApprovalTypes";
import { toAgentApprovalSummary } from "./AgentApprovalViews";
type ExecutionReasoning = SerializableExecutionReasoning;

type AgentApprovalRow = Readonly<{
  id: string;
  executionId: string;
  ownerId: string;
  status: string;
  decision: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  expiresAt: Date | string | null;
  decidedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}>;

export function buildAgentExecutionSummary(
  execution: AgentExecutionRecord,
  approval: AgentApprovalRow | null = null,
): AgentExecutionSummary {
  const reasoning = getExecutionReasoning(execution.reasoning);
  const purchase = reasoning?.purchase ?? null;
  const failure = reasoning?.failure ?? null;
  const selectedResource = reasoning?.selectedResource ?? null;
  const policy = reasoning?.policy ?? null;
  const updatedAt = execution.completedAt ?? execution.startedAt;
  const approvalView = approval ? buildApprovalView(approval, execution) : null;

  return {
    id: execution.id,
    goal: extractGoalLabel(reasoning, execution.goal),
    status: normalizeStatus(execution.status),
    decision: execution.decision,
    policyId: policy?.policyId ?? null,
    policyName: policy?.policyName ?? null,
    policyVersion: policy?.policyVersion ?? null,
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
    approvalId: approvalView?.id ?? null,
    approvalStatus: approvalView?.status ?? null,
    approvalDecision: approvalView?.decision ?? null,
    approvalReasonCode: approvalView?.reasonCode ?? null,
    approvalReasonText: approvalView?.reasonText ?? null,
    approvalDecidedAt: approvalView?.decidedAt ?? null,
  };
}

export function buildAgentExecutionDetailView(
  execution: AgentExecutionRecord,
  approval: AgentApprovalDetailView | null = null,
): AgentExecutionDetailView {
  const reasoning = getExecutionReasoning(execution.reasoning);
  const purchase = reasoning?.purchase ?? null;
  const failure = reasoning?.failure ?? null;
  const updatedAt = execution.completedAt ?? execution.startedAt;
  const approvalView = approval;

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
    approval: approvalView,
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

  if (execution.approval) {
    const approvalStatus = execution.approval.status;
    const approvalMessage =
      approvalStatus === "APPROVED"
        ? "The owner approved the purchase."
        : approvalStatus === "REJECTED"
          ? "The owner rejected the purchase."
          : approvalStatus === "EXPIRED"
            ? "The approval expired before it was acted on."
            : approvalStatus === "NO_LONGER_ACTIONABLE"
              ? "The approval is no longer actionable."
              : "The purchase is waiting for owner confirmation.";

    events.push({
      key: "approval",
      label:
        approvalStatus === "APPROVED"
          ? "Approval approved"
          : approvalStatus === "REJECTED"
            ? "Approval rejected"
            : approvalStatus === "EXPIRED"
              ? "Approval expired"
              : approvalStatus === "NO_LONGER_ACTIONABLE"
                ? "Approval closed"
                : "Approval requested",
      status:
        approvalStatus === "APPROVED"
          ? "COMPLETE"
          : approvalStatus === "REJECTED" || approvalStatus === "EXPIRED"
            ? "SKIPPED"
            : approvalStatus === "NO_LONGER_ACTIONABLE"
              ? "FAILED"
              : "CURRENT",
      timestamp:
        execution.approval.decidedAt ??
        execution.approval.expiresAt ??
        execution.createdAt,
      message: approvalMessage,
    });
  } else if (execution.status !== "CREATED") {
    events.push({
      key: "approval",
      label: "Approval requested",
      status: "COMPLETE",
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

function buildApprovalView(
  approval: AgentApprovalRow,
  execution: AgentExecutionRecord,
) : AgentApprovalDetailView {
  const summary = toAgentApprovalSummary(
    {
      id: approval.id,
      executionId: approval.executionId,
      ownerId: approval.ownerId,
      status: approval.status,
      decision: approval.decision,
      reasonCode: approval.reasonCode,
      reasonText: approval.reasonText,
      expiresAt: approval.expiresAt,
      decidedAt: approval.decidedAt,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    },
    {
      goal: execution.goal,
      reasoning: execution.reasoning,
      estimatedCostUSDC: execution.estimatedCostUSDC,
      startedAt: execution.startedAt,
    },
  );

  return {
    ...summary,
    status: summary.approvalStatus,
  };
}

function normalizeApprovalStatus(value: string): AgentApprovalStatus {
  if (
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "EXPIRED" ||
    value === "NO_LONGER_ACTIONABLE"
  ) {
    return value;
  }

  return "PENDING";
}

function normalizeApprovalDecision(value: string | null): AgentApprovalDecision | null {
  if (value === "APPROVED" || value === "REJECTED") {
    return value;
  }

  return null;
}

function normalizeRejectionReason(value: string | null): AgentApprovalRejectionReason | null {
  if (
    value === "TOO_EXPENSIVE" ||
    value === "LOW_CONFIDENCE" ||
    value === "NOT_RELEVANT" ||
    value === "NO_LONGER_NEEDED" ||
    value === "OTHER"
  ) {
    return value;
  }

  return null;
}

function toOptionalIsoString(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return toIsoString(value);
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function extractApprovalSource(reasoning: SerializableExecutionReasoning | null): AgentApprovalSource {
  const record = reasoning ? (reasoning as unknown as Record<string, unknown>) : null;
  const source = typeof record?.source === "string" ? record.source : null;
  const trigger = typeof record?.trigger === "string" ? record.trigger : null;

  if (source === "SCHEDULED" || trigger === "SCHEDULED") {
    return "SCHEDULED";
  }

  return extractSchedule(reasoning) ? "SCHEDULED" : "MANUAL";
}

function extractSchedule(reasoning: SerializableExecutionReasoning | null) {
  const record = reasoning ? (reasoning as unknown as Record<string, unknown>) : null;
  const nested = (record?.schedule as Record<string, unknown> | undefined) ?? null;
  const id =
    readString(record?.scheduleId) ??
    readString(nested?.id) ??
    null;
  const name =
    readString(record?.scheduleName) ??
    readString(nested?.name) ??
    null;

  if (!id && !name) {
    return null;
  }

  return {
    id: id ?? "schedule",
    name: name ?? "Scheduled run",
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
