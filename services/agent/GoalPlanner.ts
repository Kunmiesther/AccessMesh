import type { AgentGoalPlan } from "./types";

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "below",
  "best",
  "by",
  "can",
  "could",
  "for",
  "from",
  "give",
  "go",
  "good",
  "find",
  "help",
  "i",
  "in",
  "into",
  "is",
  "it",
  "me",
  "need",
  "needs",
  "of",
  "on",
  "or",
  "please",
  "show",
  "search",
  "the",
  "their",
  "this",
  "to",
  "under",
  "usdc",
  "want",
  "what",
  "with",
  "would",
  "you",
]);

export function planAgentGoal(goal: string): AgentGoalPlan {
  const originalGoal = normalizeWhitespace(goal);
  const budgetValues = extractBudgetValues(originalGoal);
  const queryWithoutBudget = normalizeWhitespace(
    originalGoal.replace(createBudgetPattern(), " "),
  ).toLowerCase();

  return {
    originalGoal,
    normalizedQuery: queryWithoutBudget,
    keywords: extractKeywords(queryWithoutBudget),
    ...(budgetValues !== undefined ? { maximumPriceUSDC: budgetValues } : {}),
  };
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function extractBudgetValues(value: string) {
  const matches = [...value.matchAll(createBudgetPattern())];
  if (matches.length === 0) {
    return undefined;
  }

  const prices = matches
    .map((match) => Number.parseFloat(match[1]))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    return undefined;
  }

  return Math.min(...prices);
}

function createBudgetPattern() {
  return /\b(?:under|below|maximum|max)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\s*usdc\b/gi;
}

function extractKeywords(value: string) {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const tokens = value.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) ?? [];

  for (const token of tokens) {
    const keyword = token.trim().toLowerCase();
    if (!keyword || STOP_WORDS.has(keyword) || /^\d+(?:\.\d+)?$/.test(keyword)) {
      continue;
    }

    if (seen.has(keyword)) {
      continue;
    }

    seen.add(keyword);
    keywords.push(keyword);
  }

  return keywords;
}
