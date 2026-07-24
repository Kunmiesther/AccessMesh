import type {
  AgentBudgetPolicy,
  AgentDecision,
  AgentGoalPlan,
  AgentResourceCandidate,
  CandidateEvaluation,
} from "./types";
import { evaluateAgentBudgetPolicy } from "./BudgetManager";

const TITLE_WEIGHT = 18;
const TOPIC_WEIGHT = 16;
const SUMMARY_WEIGHT = 8;
const DESCRIPTION_WEIGHT = 4;
const CATEGORY_WEIGHT = 10;
const COLLECTION_WEIGHT = 6;
const PLACEMENT_WEIGHT = 4;
const RECENCY_MAX_WEIGHT = 10;

export function evaluateAgentResourceCandidate(params: {
  goal: AgentGoalPlan;
  policy: AgentBudgetPolicy;
  resource: AgentResourceCandidate;
  referenceDate?: Date;
}): CandidateEvaluation {
  const { goal, policy, resource } = params;
  const referenceDate = params.referenceDate ?? new Date();
  const budget = evaluateAgentBudgetPolicy({
    resourcePriceUSDC: resource.priceUSDC,
    policy,
    goalMaximumPriceUSDC: goal.maximumPriceUSDC,
  });

  const matchedKeywords = new Set<string>();
  const reasons: string[] = [...budget.reasons];
  let matchScore = 0;

  for (const keyword of goal.keywords) {
    const keywordMatches: string[] = [];
    const normalizedKeyword = keyword.toLowerCase();

    if (matchesWord(resource.title, normalizedKeyword)) {
      matchScore += TITLE_WEIGHT;
      keywordMatches.push(`title (+${TITLE_WEIGHT})`);
    }

    if (resource.aiTopics.some((topic) => matchesWord(topic, normalizedKeyword))) {
      matchScore += TOPIC_WEIGHT;
      keywordMatches.push(`aiTopics (+${TOPIC_WEIGHT})`);
    }

    if (resource.aiSummary && matchesWord(resource.aiSummary, normalizedKeyword)) {
      matchScore += SUMMARY_WEIGHT;
      keywordMatches.push(`aiSummary (+${SUMMARY_WEIGHT})`);
    }

    if (matchesWord(resource.description, normalizedKeyword)) {
      matchScore += DESCRIPTION_WEIGHT;
      keywordMatches.push(`description (+${DESCRIPTION_WEIGHT})`);
    }

    if (resource.aiCategory && matchesWord(resource.aiCategory, normalizedKeyword)) {
      matchScore += CATEGORY_WEIGHT;
      keywordMatches.push(`aiCategory (+${CATEGORY_WEIGHT})`);
    }

    if (resource.aiCollection && matchesWord(resource.aiCollection, normalizedKeyword)) {
      matchScore += COLLECTION_WEIGHT;
      keywordMatches.push(`aiCollection (+${COLLECTION_WEIGHT})`);
    }

    if (resource.aiPlacement && matchesWord(resource.aiPlacement, normalizedKeyword)) {
      matchScore += PLACEMENT_WEIGHT;
      keywordMatches.push(`aiPlacement (+${PLACEMENT_WEIGHT})`);
    }

    if (keywordMatches.length > 0) {
      matchedKeywords.add(normalizedKeyword);
      reasons.push(
        `Keyword "${normalizedKeyword}" matched ${keywordMatches.join(", ")}.`,
      );
    }
  }

  const recencyBonus = computeRecencyBonus(resource, referenceDate);
  if (recencyBonus > 0) {
    matchScore += recencyBonus;
    reasons.push(`Recency bonus (+${recencyBonus}).`);
  }

  const boundedScore = Math.min(100, Math.max(0, Math.round(matchScore)));

  if (budget.eligible) {
    reasons.unshift("Budget eligible.");
  }

  if (matchedKeywords.size === 0) {
    reasons.push("No keyword matches were found.");
  }

  return {
    resource,
    matchScore: boundedScore,
    matchedKeywords: [...matchedKeywords],
    budgetEligible: budget.eligible,
    reasons,
  };
}

export function rankAgentResourceCandidates(params: {
  goal: AgentGoalPlan;
  policy: AgentBudgetPolicy;
  resources: readonly AgentResourceCandidate[];
  referenceDate?: Date;
}): CandidateEvaluation[] {
  const evaluations = params.resources.map((resource) =>
    evaluateAgentResourceCandidate({
      goal: params.goal,
      policy: params.policy,
      resource,
      referenceDate: params.referenceDate,
    }),
  );

  return evaluations.sort(compareCandidateEvaluations);
}

export function selectAgentResourceCandidate(params: {
  goal: AgentGoalPlan;
  policy: AgentBudgetPolicy;
  resources: readonly AgentResourceCandidate[];
  referenceDate?: Date;
}): {
  decision: AgentDecision;
  selectedResource: AgentResourceCandidate | null;
  selectedEvaluation: CandidateEvaluation | null;
  candidates: CandidateEvaluation[];
} {
  const candidates = rankAgentResourceCandidates(params);
  const selectedEvaluation = candidates[0] ?? null;

  if (
    !selectedEvaluation ||
    !selectedEvaluation.budgetEligible ||
    selectedEvaluation.matchScore < params.policy.minimumMatchScore
  ) {
    return {
      decision: "SKIP",
      selectedResource: null,
      selectedEvaluation: null,
      candidates,
    };
  }

  return {
    decision: "BUY",
    selectedResource: selectedEvaluation.resource,
    selectedEvaluation,
    candidates,
  };
}

function compareCandidateEvaluations(
  a: CandidateEvaluation,
  b: CandidateEvaluation,
) {
  if (a.budgetEligible !== b.budgetEligible) {
    return a.budgetEligible ? -1 : 1;
  }

  if (b.matchScore !== a.matchScore) {
    return b.matchScore - a.matchScore;
  }

  const publicationDiff =
    getCandidatePublicationTime(b.resource) - getCandidatePublicationTime(a.resource);
  if (publicationDiff !== 0) {
    return publicationDiff;
  }

  if (a.resource.priceUSDC !== b.resource.priceUSDC) {
    return a.resource.priceUSDC - b.resource.priceUSDC;
  }

  return a.resource.id.localeCompare(b.resource.id);
}

function getCandidatePublicationTime(resource: AgentResourceCandidate) {
  const source = resource.publishedAt ?? resource.createdAt;
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeRecencyBonus(
  resource: AgentResourceCandidate,
  referenceDate: Date,
) {
  const publicationTime = getCandidatePublicationTime(resource);
  if (publicationTime === 0) {
    return 0;
  }

  const referenceTime = referenceDate.getTime();
  const ageMs = Math.max(0, referenceTime - publicationTime);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) {
    return RECENCY_MAX_WEIGHT;
  }

  if (ageDays <= 30) {
    return 8;
  }

  if (ageDays <= 90) {
    return 6;
  }

  if (ageDays <= 180) {
    return 3;
  }

  return 1;
}

function matchesWord(value: string, keyword: string) {
  const normalizedValue = normalizeText(value);
  const escapedKeyword = escapeRegExp(keyword);
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i");
  return pattern.test(normalizedValue);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
