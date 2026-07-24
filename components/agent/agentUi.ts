import type {
  AgentBudgetPolicy,
  AgentDecision,
  AgentGoalPlan,
  CandidateEvaluation,
} from "@/services/agent/types";
import type {
  AgentCandidateEvaluationView,
  AgentComposerFields,
  AgentComposerValidationResult,
  AgentResourceCandidateView,
  AgentRunApiResponse,
  AgentRuntimeResultView,
} from "./types";

export function validateAgentComposerFields(
  fields: AgentComposerFields,
): AgentComposerValidationResult {
  const errors: Partial<Record<keyof AgentComposerFields, string>> = {};

  const goal = fields.goal.trim();
  if (!goal) {
    errors.goal = "Goal is required.";
  }

  const remainingBudgetUSDC = parsePositiveNumber(
    fields.remainingBudgetUSDC,
    "Remaining budget must be a positive number.",
    errors,
    "remainingBudgetUSDC",
  );

  const maxPurchaseUSDC = parsePositiveNumber(
    fields.maxPurchaseUSDC,
    "Maximum purchase must be a positive number.",
    errors,
    "maxPurchaseUSDC",
  );

  const minimumMatchScore = parseMatchScore(
    fields.minimumMatchScore,
    errors,
  );

  if (
    remainingBudgetUSDC !== null &&
    maxPurchaseUSDC !== null &&
    maxPurchaseUSDC > remainingBudgetUSDC
  ) {
    errors.maxPurchaseUSDC =
      "Maximum single purchase cannot exceed remaining budget.";
  }

  if (
    remainingBudgetUSDC !== null &&
    maxPurchaseUSDC !== null &&
    remainingBudgetUSDC <= 0
  ) {
    errors.remainingBudgetUSDC = "Remaining budget must be greater than 0.";
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors || minimumMatchScore === null || remainingBudgetUSDC === null || maxPurchaseUSDC === null) {
    return {
      ok: false,
      errors,
      policy: null,
    };
  }

  return {
    ok: true,
    errors,
    policy: {
      remainingBudgetUSDC,
      maxPurchaseUSDC,
      minimumMatchScore,
    },
  };
}

export function calculateRemainingBudget(
  startingBudgetUSDC: number,
  selectedPriceUSDC: number,
) {
  return roundUsdc(Math.max(0, startingBudgetUSDC - selectedPriceUSDC));
}

export function getSelectedCandidateId(result: AgentRuntimeResultView) {
  return result.selectedResource?.id ?? result.selectedEvaluation?.resource.id ?? null;
}

export function formatBuyAgentResult(
  result: AgentRuntimeResultView,
  policy: AgentBudgetPolicy,
) {
  const selectedPriceUSDC = result.selectedResource?.priceUSDC ?? 0;
  return {
    title: "Recommended purchase",
    selectedPriceUSDC,
    remainingBudgetUSDC: calculateRemainingBudget(
      policy.remainingBudgetUSDC,
      selectedPriceUSDC,
    ),
    matchedKeywords:
      result.selectedEvaluation?.matchedKeywords ?? result.goal.keywords ?? [],
    reasons: result.selectedEvaluation?.reasons ?? [],
    resourceLabel: result.selectedResource?.title ?? "Unknown resource",
    decisionLabel: result.decision,
  };
}

export function formatSkipAgentResult(
  result: AgentRuntimeResultView,
  policy: AgentBudgetPolicy,
) {
  const reasons = deriveSkipReasons(result, policy);
  return {
    title: "No purchase recommended",
    selectedPriceUSDC: 0,
    remainingBudgetUSDC: roundUsdc(policy.remainingBudgetUSDC),
    matchedKeywords: [] as string[],
    reasons,
    decisionLabel: result.decision,
  };
}

export function sanitizeAgentRunResponse(
  input: unknown,
): AgentRunApiResponse | null {
  if (!isRecord(input) || typeof input.ok !== "boolean") {
    return null;
  }

  if (input.ok === false) {
    return typeof input.error === "string" ? { ok: false, error: input.error } : null;
  }

  const result = sanitizeRuntimeResult(input.result);
  if (!result) {
    return null;
  }

  return {
    ok: true,
    result,
  };
}

export function sanitizeRuntimeResult(
  input: unknown,
): AgentRuntimeResultView | null {
  if (!isRecord(input)) {
    return null;
  }

  const goal = sanitizeGoalPlan(input.goal);
  const decision = input.decision === "BUY" || input.decision === "SKIP" ? input.decision : null;
  const candidates = sanitizeCandidateEvaluations(input.candidates);
  const selectedResource = sanitizeResourceCandidate(input.selectedResource);
  const selectedEvaluation = sanitizeCandidateEvaluation(input.selectedEvaluation);
  const trace = sanitizeTrace(input.trace);

  if (!goal || !decision || !trace) {
    return null;
  }

  return {
    goal,
    decision,
    selectedResource,
    selectedEvaluation,
    candidates,
    trace,
  };
}

export function sanitizeResourceCandidate(
  input: unknown,
): AgentResourceCandidateView | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = normalizeString(input.id);
  const title = normalizeString(input.title);
  const description = normalizeString(input.description);
  const resourceType = normalizeString(input.resourceType);
  const publishedAt = normalizeOptionalString(input.publishedAt);
  const createdAt = normalizeString(input.createdAt);
  const priceUSDC = normalizeFiniteNumber(input.priceUSDC);
  const aiSummary = normalizeOptionalString(input.aiSummary);
  const aiCategory = normalizeOptionalString(input.aiCategory);
  const aiCollection = normalizeOptionalString(input.aiCollection);
  const aiPlacement = normalizeOptionalString(input.aiPlacement);
  const aiTopics = normalizeStringArray(input.aiTopics);

  if (
    !id ||
    !title ||
    !description ||
    !resourceType ||
    priceUSDC === null ||
    !createdAt ||
    aiTopics === null
  ) {
    return null;
  }

  return {
    id,
    title,
    description,
    priceUSDC,
    resourceType,
    aiSummary,
    aiTopics,
    aiCategory,
    aiCollection,
    aiPlacement,
    publishedAt,
    createdAt,
  };
}

export function sanitizeCandidateEvaluation(
  input: unknown,
): AgentCandidateEvaluationView | null {
  if (!isRecord(input)) {
    return null;
  }

  const resource = sanitizeResourceCandidate(input.resource);
  const matchScore = normalizeFiniteNumber(input.matchScore);
  const matchedKeywords = normalizeStringArray(input.matchedKeywords);
  const budgetEligible = typeof input.budgetEligible === "boolean" ? input.budgetEligible : null;
  const reasons = normalizeStringArray(input.reasons);

  if (!resource || matchScore === null || matchedKeywords === null || budgetEligible === null || reasons === null) {
    return null;
  }

  return {
    resource,
    matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
    matchedKeywords,
    budgetEligible,
    reasons,
  };
}

export function sanitizeCandidateEvaluations(
  input: unknown,
): AgentCandidateEvaluationView[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => sanitizeCandidateEvaluation(item))
    .filter((item): item is AgentCandidateEvaluationView => Boolean(item));
}

export function deriveSkipReasons(
  result: AgentRuntimeResultView,
  policy: AgentBudgetPolicy,
) {
  const reasons: string[] = [];

  if (result.candidates.length === 0) {
    reasons.push("No relevant marketplace resources were found.");
    return reasons;
  }

  if (!result.candidates.some((candidate) => candidate.budgetEligible)) {
    reasons.push("Matching resources exceeded the budget.");
  }

  const bestScore = Math.max(...result.candidates.map((candidate) => candidate.matchScore));
  if (bestScore < policy.minimumMatchScore) {
    reasons.push("No candidate met the match threshold.");
  }

  if (reasons.length === 0) {
    reasons.push("No candidate was suitable for purchase.");
  }

  return reasons;
}

export function reviewSelectedCandidate(
  target:
    | {
        scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
      }
    | null
    | undefined,
) {
  target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

export function getCandidateStatusLabel(candidate: AgentCandidateEvaluationView) {
  return candidate.budgetEligible ? "Budget eligible" : "Over budget";
}

export function buildCandidateSubtitle(candidate: AgentCandidateEvaluationView) {
  return candidate.resource.aiCollection || candidate.resource.aiPlacement || "Uncategorized";
}

export function formatAgentDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sanitizeGoalPlan(input: unknown): AgentGoalPlan | null {
  if (!isRecord(input)) {
    return null;
  }

  const originalGoal = normalizeString(input.originalGoal);
  const normalizedQuery = normalizeString(input.normalizedQuery);
  const keywords = normalizeStringArray(input.keywords);

  if (!originalGoal || !normalizedQuery || keywords === null) {
    return null;
  }

  const maximumPriceUSDC =
    typeof input.maximumPriceUSDC === "number" && Number.isFinite(input.maximumPriceUSDC)
      ? input.maximumPriceUSDC
      : undefined;

  return {
    originalGoal,
    normalizedQuery,
    keywords,
    ...(maximumPriceUSDC !== undefined ? { maximumPriceUSDC } : {}),
  };
}

function sanitizeTrace(input: unknown) {
  if (!Array.isArray(input)) {
    return null;
  }

  const trace = input
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const step = normalizeString(item.step);
      const message = normalizeString(item.message);
      const status = item.status === "SUCCESS" || item.status === "FAILED" || item.status === "SKIPPED"
        ? item.status
        : null;

      if (!step || !message || !status) {
        return null;
      }

      return {
        step,
        status,
        message,
      };
    })
    .filter((item): item is { step: string; status: "SUCCESS" | "FAILED" | "SKIPPED"; message: string } => Boolean(item));

  return trace;
}

function parsePositiveNumber(
  value: string,
  message: string,
  errors: Partial<Record<keyof AgentComposerFields, string>>,
  field: keyof AgentComposerFields,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors[field] = message;
    return null;
  }

  return parsed;
}

function parseMatchScore(
  value: string,
  errors: Partial<Record<keyof AgentComposerFields, string>>,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    errors.minimumMatchScore = "Match score must be between 0 and 100.";
    return null;
  }

  return Math.round(parsed);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.filter((item): item is string => typeof item === "string");
  return items;
}

function normalizeFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function roundUsdc(value: number) {
  return Math.round(value * 100) / 100;
}
