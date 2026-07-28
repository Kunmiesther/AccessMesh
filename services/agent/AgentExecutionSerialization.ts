import type {
  SerializableCandidateComparisonSummary,
  SerializableCandidateEvaluationSnapshot,
  SerializableExecutionReasoning,
  SerializableFailureMetadata,
  SerializableGoalSnapshot,
  SerializablePaymentMetadata,
  SerializablePolicySnapshot,
  SerializableResourceSnapshot,
  SerializableSettlementMetadata,
  SerializableTraceEntry,
  SerializableUnlockMetadata,
} from "./AgentExecutionTypes";
import type {
  AgentResourceCandidate,
  CandidateEvaluation,
} from "./types";

export function serializePolicySnapshot(
  policy: SerializablePolicySnapshot,
): SerializablePolicySnapshot {
  return sanitizeJsonValue(policy) as SerializablePolicySnapshot;
}

export function serializeGoalSnapshot(
  goal: SerializableGoalSnapshot,
): SerializableGoalSnapshot {
  return sanitizeJsonValue(goal) as SerializableGoalSnapshot;
}

export function serializeResourceSnapshot(
  resource: SerializableResourceSnapshot,
): SerializableResourceSnapshot {
  return sanitizeJsonValue(resource) as SerializableResourceSnapshot;
}

export function serializeCandidateEvaluationSnapshot(
  candidate: SerializableCandidateEvaluationSnapshot,
): SerializableCandidateEvaluationSnapshot {
  return sanitizeJsonValue(candidate) as SerializableCandidateEvaluationSnapshot;
}

export function serializeTraceEntries(
  trace: readonly SerializableTraceEntry[],
): SerializableTraceEntry[] {
  return sanitizeJsonValue(trace) as SerializableTraceEntry[];
}

export function serializeCandidateComparisonSummary(
  summary: SerializableCandidateComparisonSummary,
): SerializableCandidateComparisonSummary {
  return sanitizeJsonValue(summary) as SerializableCandidateComparisonSummary;
}

export function serializePaymentMetadata(
  payment: SerializablePaymentMetadata,
): SerializablePaymentMetadata {
  return sanitizeJsonValue(payment) as SerializablePaymentMetadata;
}

export function serializeSettlementMetadata(
  settlement: SerializableSettlementMetadata,
): SerializableSettlementMetadata {
  return sanitizeJsonValue(settlement) as SerializableSettlementMetadata;
}

export function serializeUnlockMetadata(
  unlock: SerializableUnlockMetadata,
): SerializableUnlockMetadata {
  return sanitizeJsonValue(unlock) as SerializableUnlockMetadata;
}

export function serializeFailureMetadata(
  failure: SerializableFailureMetadata,
): SerializableFailureMetadata {
  return sanitizeJsonValue(failure) as SerializableFailureMetadata;
}

export function toSerializableResourceSnapshot(
  resource: AgentResourceCandidate,
): SerializableResourceSnapshot {
  return serializeResourceSnapshot({
    id: resource.id,
    title: resource.title,
    description: resource.description,
    priceUSDC: resource.priceUSDC,
    resourceType: resource.resourceType,
    aiSummary: resource.aiSummary,
    aiTopics: resource.aiTopics,
    aiCategory: resource.aiCategory,
    aiCollection: resource.aiCollection,
    aiPlacement: resource.aiPlacement,
    publishedAt: resource.publishedAt,
    createdAt: resource.createdAt,
  });
}

export function toSerializableCandidateEvaluationSnapshot(
  candidate: CandidateEvaluation,
): SerializableCandidateEvaluationSnapshot {
  return serializeCandidateEvaluationSnapshot({
    resource: toSerializableResourceSnapshot(candidate.resource),
    matchScore: candidate.matchScore,
    matchedKeywords: candidate.matchedKeywords,
    budgetEligible: candidate.budgetEligible,
    reasons: candidate.reasons,
  });
}

export function buildCandidateComparisonSummary(input: {
  candidates: readonly CandidateEvaluation[];
  selectedResourceId: string | null;
}): SerializableCandidateComparisonSummary {
  const budgetEligibleCount = input.candidates.filter((candidate) => candidate.budgetEligible).length;
  const topMatchScore =
    input.candidates.length > 0
      ? Math.max(...input.candidates.map((candidate) => candidate.matchScore))
      : null;
  const selectedCandidateId = input.selectedResourceId ?? null;
  const summary =
    input.candidates.length === 0
      ? "No marketplace candidates were evaluated."
      : selectedCandidateId
        ? `Selected ${selectedCandidateId} from ${input.candidates.length} candidate(s).`
        : "No candidate met the buy threshold.";

  return serializeCandidateComparisonSummary({
    candidateCount: input.candidates.length,
    budgetEligibleCount,
    selectedCandidateId,
    topMatchScore,
    summary,
  });
}

export function buildExecutionReasoning(input: SerializableExecutionReasoning) {
  return sanitizeJsonValue(input) as SerializableExecutionReasoning;
}

export function sanitizeJsonValue<T>(value: T): T {
  return sanitizeValue(value, new WeakSet()) as T;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return value;
  }

  if (valueType === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (valueType === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, seen))
      .filter((item) => item !== undefined);
  }

  if (valueType === "object") {
    if (seen.has(value as object)) {
      return null;
    }

    seen.add(value as object);

    if (isDecimalLike(value)) {
      return (value as { toString: () => string }).toString();
    }

    if (!isPlainObject(value)) {
      return sanitizeNonPlainObject(value, seen);
    }

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeValue(nestedValue, seen);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }

    return result;
  }

  return undefined;
}

function sanitizeNonPlainObject(value: unknown, seen: WeakSet<object>) {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toJSON?: () => unknown }).toJSON === "function"
  ) {
    try {
      return sanitizeValue((value as { toJSON: () => unknown }).toJSON(), seen);
    } catch {
      return sanitizeValue(String(value), seen);
    }
  }

  return String(value);
}

function isPlainObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDecimalLike(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
  return ctorName === "Decimal" || ctorName === "PrismaDecimal";
}
