import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentResultSummary } from "../../components/agent/AgentResultSummary";
import {
  canApproveAgentPurchaseReview,
  canReviewAgentPurchase,
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
  candidates: [],
  trace: [],
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
  trace: [],
};

test("review purchase only appears for a valid BUY result", () => {
  assert.equal(canReviewAgentPurchase(buyResult), true);
  assert.equal(canReviewAgentPurchase(skipResult), false);

  const buyMarkup = renderToStaticMarkup(
    <AgentResultSummary result={buyResult} policy={policy} />,
  );
  const skipMarkup = renderToStaticMarkup(
    <AgentResultSummary result={skipResult} policy={policy} />,
  );

  assert.match(buyMarkup, /Review purchase/);
  assert.equal(skipMarkup.includes("Review purchase"), false);
});

test("selected resource details and completion state are rendered safely", () => {
  const completedMarkup = renderToStaticMarkup(
    <AgentResultSummary
      result={buyResult}
      policy={policy}
      purchaseCompletion={{
        resourceId: "resource-1",
        resourceTitle: "Circle CCTP Guide",
        amountUSDC: 0.2,
        txHash: "0xbbbb",
        settlementStatus: "SETTLED",
        unlocked: true,
        explorerUrl: "https://example.com/tx/0xbbbb",
      }}
    />,
  );

  assert.match(completedMarkup, /Purchase complete/);
  assert.match(completedMarkup, /Open unlocked resource/);
  assert.match(completedMarkup, /Circle CCTP Guide/);
  assert.equal(completedMarkup.includes("hidden reasoning"), false);
});

test("duplicate submission is blocked while the purchase is running", () => {
  assert.equal(
    canApproveAgentPurchaseReview({
      ready: true,
      connected: true,
      address: "0x1111111111111111111111111111111111111111",
      bundlerClient: {},
      result: buyResult,
      policy,
      previewIntentLoaded: true,
      isSubmitting: true,
      previewLoading: false,
      stage: "SUBMITTING_PAYMENT",
      error: null,
    }),
    false,
  );
});
