import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentResultSummary } from "../../components/agent/AgentResultSummary";
import {
  calculateRemainingBudget,
  getSelectedCandidateId,
  reviewSelectedCandidate,
  sanitizeAgentRunResponse,
  validateAgentComposerFields,
  formatBuyAgentResult,
  formatSkipAgentResult,
} from "../../components/agent/agentUi";
import type { AgentRuntimeResultView } from "../../components/agent/types";

const policy = {
  remainingBudgetUSDC: 1,
  maxPurchaseUSDC: 0.25,
  minimumMatchScore: 35,
};

const buyResult: AgentRuntimeResultView = {
  goal: {
    originalGoal: "Find the best Circle CCTP guide under 0.20 USDC",
    normalizedQuery: "circle cctp guide",
    keywords: ["circle", "cctp", "guide"],
    maximumPriceUSDC: 0.2,
  },
  decision: "BUY",
  selectedResource: {
    id: "resource-1",
    title: "Circle CCTP Guide",
    description: "Guide",
    priceUSDC: 0.2,
    resourceType: "CONTENT",
    aiSummary: null,
    aiTopics: ["circle", "cctp"],
    aiCategory: null,
    aiCollection: "Payments",
    aiPlacement: "Featured",
    publishedAt: "2026-07-24T00:00:00.000Z",
    createdAt: "2026-07-24T00:00:00.000Z",
  },
  selectedEvaluation: {
    resource: {
      id: "resource-1",
      title: "Circle CCTP Guide",
      description: "Guide",
      priceUSDC: 0.2,
      resourceType: "CONTENT",
      aiSummary: null,
      aiTopics: ["circle", "cctp"],
      aiCategory: null,
      aiCollection: "Payments",
      aiPlacement: "Featured",
      publishedAt: "2026-07-24T00:00:00.000Z",
      createdAt: "2026-07-24T00:00:00.000Z",
    },
    matchScore: 82,
    matchedKeywords: ["circle", "cctp", "guide"],
    budgetEligible: true,
    reasons: ["Keyword \"guide\" matched title (+18)."],
  },
  candidates: [
    {
      resource: {
        id: "resource-1",
        title: "Circle CCTP Guide",
        description: "Guide",
        priceUSDC: 0.2,
        resourceType: "CONTENT",
        aiSummary: null,
        aiTopics: ["circle", "cctp"],
        aiCategory: null,
        aiCollection: "Payments",
        aiPlacement: "Featured",
        publishedAt: "2026-07-24T00:00:00.000Z",
        createdAt: "2026-07-24T00:00:00.000Z",
      },
      matchScore: 82,
      matchedKeywords: ["circle", "cctp", "guide"],
      budgetEligible: true,
      reasons: ["Keyword \"guide\" matched title (+18)."],
    },
  ],
  trace: [
    {
      step: "goal_planned",
      status: "SUCCESS",
      message: "Goal normalized.",
    },
  ],
};

const skipResult: AgentRuntimeResultView = {
  goal: {
    originalGoal: "Unmatched niche topic",
    normalizedQuery: "unmatched niche topic",
    keywords: ["unmatched", "niche", "topic"],
  },
  decision: "SKIP",
  selectedResource: null,
  selectedEvaluation: null,
  candidates: [],
  trace: [
    {
      step: "decision",
      status: "SKIPPED",
      message: "No candidate met the threshold.",
    },
  ],
};

test("client validation enforces the composer rules", () => {
  const invalid = validateAgentComposerFields({
    goal: "",
    remainingBudgetUSDC: "0",
    maxPurchaseUSDC: "1",
    minimumMatchScore: "101",
  });

  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.goal ?? "", /goal is required/i);
  assert.match(
    invalid.errors.remainingBudgetUSDC ?? "",
    /positive number/i,
  );
  assert.match(invalid.errors.minimumMatchScore ?? "", /between 0 and 100/i);
});

test("budget remaining calculation is deterministic", () => {
  assert.equal(calculateRemainingBudget(1, 0.2), 0.8);
  assert.equal(calculateRemainingBudget(1, 2), 0);
});

test("BUY result formatting summarizes the recommendation", () => {
  const formatted = formatBuyAgentResult(buyResult, policy);

  assert.equal(formatted.title, "Recommended purchase");
  assert.equal(formatted.resourceLabel, "Circle CCTP Guide");
  assert.equal(formatted.selectedPriceUSDC, 0.2);
  assert.equal(formatted.remainingBudgetUSDC, 0.8);
  assert.ok(formatted.reasons.length > 0);
});

test("SKIP result formatting summarizes the rejection", () => {
  const formatted = formatSkipAgentResult(skipResult, policy);

  assert.equal(formatted.title, "No purchase recommended");
  assert.equal(formatted.selectedPriceUSDC, 0);
  assert.equal(formatted.remainingBudgetUSDC, 1);
  assert.match(formatted.reasons.join(" "), /no relevant marketplace resources/i);
});

test("selected candidate identification prefers the selected resource", () => {
  assert.equal(getSelectedCandidateId(buyResult), "resource-1");
  assert.equal(getSelectedCandidateId(skipResult), null);
});

test("malformed agent responses are rejected safely", () => {
  assert.equal(sanitizeAgentRunResponse({}), null);
  assert.equal(
    sanitizeAgentRunResponse({
      ok: true,
      result: {
        goal: null,
      },
    }),
    null,
  );
});

test("aiReasoning is not rendered directly", () => {
  const markup = renderToStaticMarkup(
    <AgentResultSummary
      result={{
        ...buyResult,
        selectedResource: {
          ...(buyResult.selectedResource ?? {}),
          aiReasoning: "do not render this string",
        } as never,
        candidates: buyResult.candidates.map((candidate) => ({
          ...candidate,
          resource: {
            ...candidate.resource,
            aiReasoning: "also hidden",
          } as never,
        })),
      }}
      policy={policy}
    />,
  );

  assert.equal(markup.includes("do not render this string"), false);
  assert.equal(markup.includes("also hidden"), false);
});

test("review purchase only scrolls to the candidate and does not trigger fetch", () => {
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  const mockFetch: typeof fetch = async () => {
    fetchCalled = true;
    return new Response("ok");
  };
  globalThis.fetch = mockFetch;

  let scrolled = 0;
  reviewSelectedCandidate({
    scrollIntoView: () => {
      scrolled += 1;
    },
  });

  globalThis.fetch = previousFetch;

  assert.equal(scrolled, 1);
  assert.equal(fetchCalled, false);
});
