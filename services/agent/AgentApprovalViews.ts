import type { AgentExecutionRecord, SerializableExecutionReasoning } from "./AgentExecutionTypes";
import type {
  AgentApprovalDetailView,
  AgentApprovalDecision,
  AgentApprovalStatus,
  AgentApprovalSummaryView,
  AgentApprovalSource,
  AgentApprovalRejectionReason,
} from "./AgentApprovalTypes";

type AgentApprovalRow = {
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
};

export function toAgentApprovalSummary(
  approval: AgentApprovalRow,
  execution: Pick<
    AgentExecutionRecord,
    "goal" | "reasoning" | "estimatedCostUSDC" | "startedAt"
  >,
): AgentApprovalSummaryView {
  const reasoning = getReasoning(execution.reasoning);
  const selectedResource = reasoning?.selectedResource ?? null;
  const selectedEvaluation = reasoning?.selectedEvaluation ?? null;
  const policy = reasoning?.policy ?? null;
  const schedule = extractSchedule(reasoning);

  return {
    id: approval.id,
    executionId: approval.executionId,
    source: extractSource(reasoning),
    goal: reasoning?.goal.originalGoal?.trim() || execution.goal,
    policy: {
      id: policy?.policyId ?? null,
      name: policy?.policyName ?? "Legacy or ad hoc policy",
      version: policy?.policyVersion ?? null,
    },
    resource: {
      id: selectedResource?.id ?? null,
      title: selectedResource?.title ?? "Unknown resource",
      category:
        selectedResource?.aiCategory ??
        selectedResource?.aiCollection ??
        selectedResource?.aiPlacement ??
        null,
    },
    recommendation: {
      score: selectedEvaluation?.matchScore ?? reasoning?.comparisonSummary?.topMatchScore ?? null,
      estimatedCostUSDC: formatUSDCString(execution.estimatedCostUSDC),
      comparisonSummary: reasoning?.comparisonSummary?.summary ?? null,
    },
    schedule,
    approvalStatus: normalizeApprovalStatus(approval.status),
    decision: normalizeApprovalDecision(approval.decision),
    reasonCode: normalizeRejectionReason(approval.reasonCode),
    reasonText: approval.reasonText,
    decidedAt: toIsoOrNull(approval.decidedAt),
    createdAt: toIsoString(approval.createdAt),
    updatedAt: toIsoString(approval.updatedAt),
    expiresAt: toIsoOrNull(approval.expiresAt),
  };
}

export function toAgentApprovalDetail(
  approval: AgentApprovalRow,
  execution: Pick<
    AgentExecutionRecord,
    "goal" | "reasoning" | "estimatedCostUSDC" | "startedAt"
  >,
): AgentApprovalDetailView {
  const summary = toAgentApprovalSummary(approval, execution);
  return {
    ...summary,
    status: summary.approvalStatus,
  };
}

function getReasoning(reasoning: SerializableExecutionReasoning | null) {
  if (!reasoning || reasoning.version !== 1) {
    return null;
  }

  return reasoning;
}

function extractSource(reasoning: SerializableExecutionReasoning | null): AgentApprovalSource {
  const record = reasoning ? (reasoning as unknown as Record<string, unknown>) : null;
  const source = typeof record?.source === "string" ? record.source : null;
  const trigger = typeof record?.trigger === "string" ? record.trigger : null;

  if (source === "SCHEDULED" || trigger === "SCHEDULED") {
    return "SCHEDULED";
  }

  if (source === "MANUAL" || trigger === "MANUAL") {
    return "MANUAL";
  }

  const schedule = extractSchedule(reasoning);
  return schedule ? "SCHEDULED" : "MANUAL";
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

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toIsoOrNull(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return toIsoString(value);
}

function formatUSDCString(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const fixed = value.toFixed(6);
  return fixed.replace(/\.?0+$/, "");
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
