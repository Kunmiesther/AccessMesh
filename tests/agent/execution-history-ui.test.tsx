import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentExecutionCard } from "../../components/agent/history/AgentExecutionCard";
import { AgentExecutionDetailPanel } from "../../components/agent/history/AgentExecutionDetailView";
import { AgentHistoryEmptyState } from "../../components/agent/history/AgentHistoryEmptyState";
import { AgentHistoryFilters } from "../../components/agent/history/AgentHistoryFilters";
import { AgentHistoryList } from "../../components/agent/history/AgentHistoryList";
import { AgentHistoryPagination } from "../../components/agent/history/AgentHistoryPagination";
import type { AgentExecutionDetailView } from "../../services/agent/AgentExecutionTypes";

test("history filters render owner-scoped form controls", () => {
  const markup = renderToStaticMarkup(
    <AgentHistoryFilters status="completed" decision="BUY" limit={10} />,
  );

  assert.equal(markup.includes('method="get"'), true);
  assert.equal(markup.includes('name="decision"'), true);
  assert.equal(markup.includes('name="status"'), true);
  assert.equal(markup.includes('name="limit" value="10"'), true);
  assert.equal(markup.includes('/agent/history'), true);
});

test("history list renders the empty state when no executions exist", () => {
  const markup = renderToStaticMarkup(
    <AgentHistoryList
      page={{ executions: [], nextCursor: null, hasMore: false }}
      query={{ limit: 10, cursor: null, status: "all", decision: "all" }}
    />,
  );

  assert.equal(markup.includes("No agent executions yet"), true);
  assert.equal(markup.includes("/agent"), true);
});

test("execution cards abbreviate transactions and link to the detail page", () => {
  const markup = renderToStaticMarkup(
    <AgentExecutionCard
      execution={{
        id: "execution-1",
        goal: "Find premium agent tooling",
        status: "FAILED",
        decision: "BUY",
        policyId: "policy-1",
        policyName: "Balanced Buyer",
        policyVersion: 1,
        selectedResourceId: "resource-1",
        selectedResourceTitle: "Premium Tooling",
        estimatedCostUSDC: 0.25,
        txHash: "0x1234567890abcdef1234567890abcdef12345678",
        createdAt: "2026-07-28T12:00:00.000Z",
        updatedAt: "2026-07-28T12:05:00.000Z",
        completedAt: "2026-07-28T12:05:00.000Z",
        failureCode: "PAYMENT_FAILED",
        failureStage: "PAYMENT",
        purchaseStatus: "FAILED",
        settlementStatus: "FAILED",
        unlockStatus: "FAILED",
      }}
    />,
  );

  assert.equal(markup.includes('href="/agent/executions/execution-1"'), true);
  assert.equal(markup.includes("0x123456"), true);
  assert.equal(markup.includes("..."), true);
  assert.equal(markup.includes("Failure: PAYMENT_FAILED"), true);
});

test("history pagination preserves filters and pagination cursor", () => {
  const markup = renderToStaticMarkup(
    <AgentHistoryPagination
      nextCursor="cursor-token"
      query={{
        limit: 10,
        cursor: null,
        status: "completed",
        decision: "BUY",
      }}
    />,
  );

  assert.equal(markup.includes("Load more"), true);
  assert.equal(markup.includes("cursor-token"), true);
  assert.equal(markup.includes("status=completed"), true);
  assert.equal(markup.includes("decision=BUY"), true);
  assert.equal(markup.includes("limit=10"), true);
});

test("execution detail renders buy, cancellation, skip, and failure states safely", () => {
  const buyMarkup = renderToStaticMarkup(<AgentExecutionDetailPanel execution={buildBuyExecution()} />);
  assert.equal(buyMarkup.includes("BUY recommendation"), true);
  assert.equal(buyMarkup.includes("Candidate 01"), true);
  assert.equal(buyMarkup.indexOf("First candidate") < buyMarkup.indexOf("Second candidate"), true);
  assert.equal(buyMarkup.includes("aiReasoning"), false);
  assert.equal(buyMarkup.includes("protected content"), false);
  assert.equal(buyMarkup.includes("View execution"), false);

  const cancelledMarkup = renderToStaticMarkup(
    <AgentExecutionDetailPanel execution={buildCancelledBuyExecution()} />,
  );
  assert.equal(cancelledMarkup.includes("Approval was cancelled before payment"), true);
  assert.equal(cancelledMarkup.includes("No payment was claimed"), true);

  const skipMarkup = renderToStaticMarkup(<AgentExecutionDetailPanel execution={buildSkipExecution()} />);
  assert.equal(skipMarkup.includes("SKIP recommendation"), true);
  assert.equal(skipMarkup.includes("No purchase was recommended"), true);

  const failureMarkup = renderToStaticMarkup(
    <AgentExecutionDetailPanel execution={buildFailureExecution()} />,
  );
  assert.equal(failureMarkup.includes("Safe failure details"), true);
  assert.equal(failureMarkup.includes("PAYMENT_SUBMITTED"), true);
  assert.equal(failureMarkup.includes("Payment rejected by trusted server flow."), true);
});

function buildBuyExecution(): AgentExecutionDetailView {
  const selectedResource = {
    id: "resource-1",
    title: "First candidate",
    description: "Description",
    priceUSDC: 0.2,
    resourceType: "CONTENT",
    aiSummary: "hidden summary",
    aiTopics: ["agent"],
    aiCategory: "AI",
    aiCollection: "Collection",
    aiPlacement: "Featured",
    publishedAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-07-28T00:00:00.000Z",
    aiReasoning: "protected",
    resourceUrl: "https://example.invalid/protected",
  } as never;

  const secondResource = {
    id: "resource-2",
    title: "Second candidate",
    description: "Description",
    priceUSDC: 0.25,
    resourceType: "CONTENT",
    aiSummary: "hidden summary",
    aiTopics: ["agent"],
    aiCategory: "AI",
    aiCollection: "Collection",
    aiPlacement: "Featured",
    publishedAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-07-28T00:00:00.000Z",
  } as never;

  return {
    id: "execution-buy",
    agentId: "agent-1",
    status: "COMPLETED",
    decision: "BUY",
    goal: {
      originalGoal: "Find premium agent tooling",
      normalizedQuery: "find premium agent tooling",
    keywords: ["premium", "agent", "tooling"],
      maximumPriceUSDC: 0.25,
    },
    policy: {
      remainingBudgetUSDC: 1,
      maxPurchaseUSDC: 0.25,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find premium agent tooling",
    candidateCount: 2,
    comparisonSummary: {
      candidateCount: 2,
      budgetEligibleCount: 2,
      selectedCandidateId: "resource-1",
      topMatchScore: 92,
      summary: "Selected candidate 1.",
    },
    selectedResource,
    selectedEvaluation: {
      resource: selectedResource,
      matchScore: 92,
      matchedKeywords: ["premium", "agent"],
      budgetEligible: true,
      reasons: ["Keyword match"],
    },
    candidates: [
      {
        resource: selectedResource,
        matchScore: 92,
        matchedKeywords: ["premium", "agent"],
        budgetEligible: true,
        reasons: ["Keyword match"],
      },
      {
        resource: secondResource,
        matchScore: 61,
        matchedKeywords: ["agent"],
        budgetEligible: true,
        reasons: ["Relevant topic"],
      },
    ],
    trace: [
      {
        step: "decision",
        status: "SUCCESS",
        message: "Selected the best candidate.",
      },
    ],
    purchase: {
      status: "COMPLETED",
      amountUSDC: 0.2,
      transactionId: "0xabc123abcdef1234567890abcdef1234567890abcd",
      resourceId: "resource-1",
      settlementStatus: "SETTLED",
      unlockStatus: "UNLOCKED",
    },
    failure: null,
    estimatedCostUSDC: 0.2,
    txHash: "0xabc123abcdef1234567890abcdef1234567890abcd",
    startedAt: "2026-07-28T12:00:00.000Z",
    createdAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:05:00.000Z",
    completedAt: "2026-07-28T12:05:00.000Z",
  } as unknown as AgentExecutionDetailView;
}

function buildCancelledBuyExecution(): AgentExecutionDetailView {
  const execution = buildBuyExecution();
  return {
    ...execution,
    status: "RECOMMENDED_BUY",
    purchase: {
      ...execution.purchase,
      status: "NOT_STARTED",
      settlementStatus: "NOT_STARTED",
      unlockStatus: "NOT_STARTED",
    },
    completedAt: null,
  } as unknown as AgentExecutionDetailView;
}

function buildSkipExecution(): AgentExecutionDetailView {
  return {
    id: "execution-skip",
    agentId: "agent-1",
    status: "RECOMMENDED_SKIP",
    decision: "SKIP",
    goal: {
      originalGoal: "Find niche content",
      normalizedQuery: "find niche content",
    keywords: ["niche", "content"],
    },
    policy: {
      remainingBudgetUSDC: 1,
      maxPurchaseUSDC: 0.25,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find niche content",
    candidateCount: 0,
    comparisonSummary: {
      candidateCount: 0,
      budgetEligibleCount: 0,
      selectedCandidateId: null,
      topMatchScore: null,
      summary: "No purchase was recommended.",
    },
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
    purchase: {
      status: "NOT_STARTED",
      amountUSDC: null,
      transactionId: null,
      resourceId: null,
      settlementStatus: "NOT_STARTED",
      unlockStatus: "NOT_STARTED",
    },
    failure: null,
    estimatedCostUSDC: null,
    txHash: null,
    startedAt: "2026-07-28T12:10:00.000Z",
    createdAt: "2026-07-28T12:10:00.000Z",
    updatedAt: "2026-07-28T12:10:00.000Z",
    completedAt: null,
  } as unknown as AgentExecutionDetailView;
}

function buildFailureExecution(): AgentExecutionDetailView {
  const execution = buildBuyExecution();
  return {
    ...execution,
    status: "FAILED",
    failure: {
      code: "PAYMENT_REJECTED",
      message: "Payment rejected by trusted server flow.",
      stage: "PAYMENT_SUBMITTED",
    },
    purchase: {
      ...execution.purchase,
      status: "FAILED",
      settlementStatus: "FAILED",
      unlockStatus: "FAILED",
    },
    completedAt: "2026-07-28T12:06:00.000Z",
  } as unknown as AgentExecutionDetailView;
}
