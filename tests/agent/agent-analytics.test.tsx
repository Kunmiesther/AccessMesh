import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getAgentAnalytics } from "../../app/api/agent/analytics/route";
import {
  createAgentOwnerSessionPayload,
  encodeAgentOwnerSession,
} from "../../lib/auth/agentOwnerSession";
import {
  AgentExecutionAnalyticsService,
  buildAgentAnalyticsSummary,
  parseAgentAnalyticsPeriod,
} from "../../services/agent/AgentExecutionAnalytics";
import { AgentAnalyticsEmptyState } from "../../components/agent/analytics/AgentAnalyticsEmptyState";
import { AgentAnalyticsHeader } from "../../components/agent/analytics/AgentAnalyticsHeader";
import { AgentAnalyticsMetricCard } from "../../components/agent/analytics/AgentAnalyticsMetricCard";
import { AgentAnalyticsPeriodSelector } from "../../components/agent/analytics/AgentAnalyticsPeriodSelector";
import { AgentDecisionBreakdown } from "../../components/agent/analytics/AgentDecisionBreakdown";
import { AgentExecutionTrend } from "../../components/agent/analytics/AgentExecutionTrend";
import { AgentFailureBreakdown } from "../../components/agent/analytics/AgentFailureBreakdown";
import { AgentGoalBreakdown } from "../../components/agent/analytics/AgentGoalBreakdown";
import { AgentSpendSummary } from "../../components/agent/analytics/AgentSpendSummary";
import { AgentTopResources } from "../../components/agent/analytics/AgentTopResources";

type AnalyticsRow = {
  id: string;
  agentId: string;
  goal: string;
  status: string;
  decision: "BUY" | "SKIP" | null;
  selectedResourceId: string | null;
  reasoning: Record<string, unknown>;
  estimatedCostUSDC: number | null;
  txHash: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

const OWNER = {
  ownerId: "owner-1",
  walletAddress: "0x1111111111111111111111111111111111111111",
  username: "accessmesh",
  authenticationMethod: "CIRCLE_SESSION" as const,
};

test("parseAgentAnalyticsPeriod defaults and validates safely", () => {
  assert.deepEqual(parseAgentAnalyticsPeriod(null), { ok: true, period: "30d" });
  assert.deepEqual(parseAgentAnalyticsPeriod("7d"), { ok: true, period: "7d" });
  assert.equal(parseAgentAnalyticsPeriod("invalid").ok, false);
});

test("buildAgentAnalyticsSummary derives safe metrics, breakdowns, and zero-filled daily trend", () => {
  const rows = [
    buildCompletedBuyRow({
      id: "exec-buy",
      goal: "Find premium agent toolkit",
      startedAt: new Date("2026-07-26T10:00:00.000Z"),
      completedAt: new Date("2026-07-26T10:02:00.000Z"),
      resourceId: "resource-a",
      title: "Premium Agent Toolkit",
      category: "AI",
      collection: "Research",
      amountUSDC: 0.2,
      matchScore: 91,
    }),
    buildSkipRow({
      id: "exec-skip",
      goal: "Find premium agent toolkit",
      startedAt: new Date("2026-07-28T10:00:00.000Z"),
      topMatchScore: 32,
    }),
    buildFailedPaymentRow({
      id: "exec-failed",
      goal: "Find premium agent toolkit",
      startedAt: new Date("2026-07-28T12:00:00.000Z"),
      completedAt: new Date("2026-07-28T12:01:00.000Z"),
      resourceId: "resource-b",
      title: "Fallback Guide",
      category: "Guides",
      collection: "Docs",
      amountUSDC: 0.3,
      matchScore: 65,
    }),
    buildRunningRow({
      id: "exec-running",
      goal: "Ongoing research goal",
      startedAt: new Date("2026-07-27T08:00:00.000Z"),
    }),
  ];

  const summary = buildAgentAnalyticsSummary(rows as never, {
    period: "30d",
    periodBounds: {
      from: new Date("2026-07-26T00:00:00.000Z"),
      to: new Date("2026-07-28T23:59:59.999Z"),
    },
  });

  assert.equal(summary.period.preset, "30d");
  assert.equal(summary.totals.executions, 4);
  assert.equal(summary.totals.buyRecommendations, 2);
  assert.equal(summary.totals.skipRecommendations, 1);
  assert.equal(summary.totals.completedExecutions, 1);
  assert.equal(summary.totals.failedExecutions, 1);
  assert.equal(summary.totals.activeExecutions, 1);
  assert.equal(summary.rates.buyRecommendationRate, 2 / 3);
  assert.equal(summary.rates.completionRate, 0.25);
  assert.equal(summary.rates.purchaseConversionRate, 1);
  assert.equal(summary.rates.failureRate, 0.25);
  assert.equal(summary.rates.unlockSuccessRate, 1);
  assert.equal(summary.spend.submittedUSDC, "0.5");
  assert.equal(summary.spend.completedUSDC, "0.2");
  assert.equal(summary.spend.averageCompletedPurchaseUSDC, "0.2");
  assert.equal(summary.performance.averageExecutionDurationMs, 120000);
  assert.equal(summary.performance.medianExecutionDurationMs, 120000);
  assert.equal(summary.performance.averageRecommendationScore, 62.7);
  assert.equal(summary.breakdowns.goals[0]?.label, "Find premium agent toolkit");
  assert.equal(summary.breakdowns.resources[0]?.title, "Premium Agent Toolkit");
  assert.equal(summary.breakdowns.resources[0]?.completedSpendUSDC, "0.2");
  assert.equal(summary.breakdowns.categories[0]?.label, "AI");
  assert.deepEqual(
    summary.breakdowns.failuresByStage.map((item) => item.label),
    ["Payment"],
  );
  assert.deepEqual(
    summary.trend.map((point) => ({
      date: point.date,
      executions: point.executions,
      completed: point.completed,
      failed: point.failed,
      completedSpendUSDC: point.completedSpendUSDC,
    })),
    [
      {
        date: "2026-07-26",
        executions: 1,
        completed: 1,
        failed: 0,
        completedSpendUSDC: "0.2",
      },
      {
        date: "2026-07-27",
        executions: 1,
        completed: 0,
        failed: 0,
        completedSpendUSDC: "0",
      },
      {
        date: "2026-07-28",
        executions: 2,
        completed: 0,
        failed: 1,
        completedSpendUSDC: "0",
      },
    ],
  );
});

test("getAnalyticsForOwner only returns the authenticated owner's executions", async () => {
  const { client, state } = createAnalyticsMockClient();
  const service = new AgentExecutionAnalyticsService(async () => client as never);

  state.executions.push(
    buildCompletedBuyRow({
      id: "owner-1-exec",
      goal: "Owner one goal",
      startedAt: new Date("2026-07-28T10:00:00.000Z"),
      completedAt: new Date("2026-07-28T10:01:00.000Z"),
      resourceId: "resource-a",
      title: "Owner One Resource",
      category: "AI",
      collection: "Research",
      amountUSDC: 0.25,
      matchScore: 88,
      agentId: "agent-1",
    }),
    buildCompletedBuyRow({
      id: "owner-2-exec",
      goal: "Owner two goal",
      startedAt: new Date("2026-07-28T11:00:00.000Z"),
      completedAt: new Date("2026-07-28T11:01:00.000Z"),
      resourceId: "resource-b",
      title: "Owner Two Resource",
      category: "Docs",
      collection: "Library",
      amountUSDC: 0.4,
      matchScore: 77,
      agentId: "agent-2",
    }),
  );

  const analytics = await service.getAnalyticsForOwner({
    ownerId: "owner-1",
    period: "30d",
  });

  assert.equal(analytics.totals.executions, 1);
  assert.equal(analytics.breakdowns.resources[0]?.title, "Owner One Resource");
  assert.equal(analytics.spend.completedUSDC, "0.25");
});

test("GET /api/agent/analytics enforces authentication, validates periods, and returns safe analytics", async () => {
  const original = AgentExecutionAnalyticsService.prototype.getAnalyticsForOwner;

  let capturedInput: { ownerId: string; period?: string } | null = null;
  AgentExecutionAnalyticsService.prototype.getAnalyticsForOwner = async function (input) {
    capturedInput = input;
    return {
      period: {
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-07-28T23:59:59.999Z",
        preset: input.period ?? "30d",
      },
      trendGranularity: "day",
      totals: {
        executions: 1,
        buyRecommendations: 1,
        skipRecommendations: 0,
        completedExecutions: 1,
        failedExecutions: 0,
        activeExecutions: 0,
      },
      rates: {
        buyRecommendationRate: 1,
        completionRate: 1,
        purchaseConversionRate: 1,
        failureRate: 0,
        unlockSuccessRate: 1,
      },
      spend: {
        submittedUSDC: "0.25",
        completedUSDC: "0.25",
        averageCompletedPurchaseUSDC: "0.25",
      },
      performance: {
        averageExecutionDurationMs: 60000,
        medianExecutionDurationMs: 60000,
        averageRecommendationScore: 88,
      },
      breakdowns: {
        decisions: [{ label: "BUY", count: 1, percentage: 1 }],
        statuses: [{ label: "Completed", count: 1, percentage: 1 }],
        failuresByStage: [],
        goals: [{ label: "Goal", count: 1, percentage: 1 }],
        resources: [
          {
            resourceId: "resource-a",
            title: "Persisted Resource",
            category: "AI",
            collection: "Research",
            recommendations: 1,
            completedPurchases: 1,
            completedSpendUSDC: "0.25",
          },
        ],
        categories: [{ label: "AI", count: 1, percentage: 1 }],
      },
      trend: [
        {
          date: "2026-07-28",
          executions: 1,
          buyRecommendations: 1,
          skipRecommendations: 0,
          completed: 1,
          failed: 0,
          completedSpendUSDC: "0.25",
        },
      ],
    };
  };

  try {
    const cookie = encodeAgentOwnerSession(createAgentOwnerSessionPayload(OWNER));
    const response = await getAgentAnalytics(
      new Request("http://localhost/api/agent/analytics?period=7d", {
        headers: {
          cookie: `accessmesh_agent_owner_session=${cookie}`,
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      ok: true,
      analytics: {
        period: {
          from: "2026-07-01T00:00:00.000Z",
          to: "2026-07-28T23:59:59.999Z",
          preset: "7d",
        },
        trendGranularity: "day",
        totals: {
          executions: 1,
          buyRecommendations: 1,
          skipRecommendations: 0,
          completedExecutions: 1,
          failedExecutions: 0,
          activeExecutions: 0,
        },
        rates: {
          buyRecommendationRate: 1,
          completionRate: 1,
          purchaseConversionRate: 1,
          failureRate: 0,
          unlockSuccessRate: 1,
        },
        spend: {
          submittedUSDC: "0.25",
          completedUSDC: "0.25",
          averageCompletedPurchaseUSDC: "0.25",
        },
        performance: {
          averageExecutionDurationMs: 60000,
          medianExecutionDurationMs: 60000,
          averageRecommendationScore: 88,
        },
        breakdowns: {
          decisions: [{ label: "BUY", count: 1, percentage: 1 }],
          statuses: [{ label: "Completed", count: 1, percentage: 1 }],
          failuresByStage: [],
          goals: [{ label: "Goal", count: 1, percentage: 1 }],
          resources: [
            {
              resourceId: "resource-a",
              title: "Persisted Resource",
              category: "AI",
              collection: "Research",
              recommendations: 1,
              completedPurchases: 1,
              completedSpendUSDC: "0.25",
            },
          ],
          categories: [{ label: "AI", count: 1, percentage: 1 }],
        },
        trend: [
          {
            date: "2026-07-28",
            executions: 1,
            buyRecommendations: 1,
            skipRecommendations: 0,
            completed: 1,
            failed: 0,
            completedSpendUSDC: "0.25",
          },
        ],
      },
    });

    assert.deepEqual(capturedInput, {
      ownerId: "owner-1",
      period: "7d",
    });

    const unauthenticated = await getAgentAnalytics(
      new Request("http://localhost/api/agent/analytics"),
    );
    assert.equal(unauthenticated.status, 401);

    const invalid = await getAgentAnalytics(
      new Request("http://localhost/api/agent/analytics?period=bad", {
        headers: {
          cookie: `accessmesh_agent_owner_session=${cookie}`,
        },
      }),
    );
    assert.equal(invalid.status, 400);
  } finally {
    AgentExecutionAnalyticsService.prototype.getAnalyticsForOwner = original;
  }
});

test("analytics components render safe owner-scoped summaries", () => {
  const headerMarkup = renderToStaticMarkup(
    <AgentAnalyticsHeader period="30d" />,
  );
  assert.equal(headerMarkup.includes("/agent"), true);
  assert.equal(headerMarkup.includes("/agent/history"), true);

  const selectorMarkup = renderToStaticMarkup(
    <AgentAnalyticsPeriodSelector period="7d" />,
  );
  assert.equal(selectorMarkup.includes('method="get"'), true);
  assert.equal(selectorMarkup.includes('name="period"'), true);

  const emptyMarkup = renderToStaticMarkup(<AgentAnalyticsEmptyState />);
  assert.equal(emptyMarkup.includes("No agent activity in this period"), true);
  assert.equal(emptyMarkup.includes("/agent/history"), true);

  const cardMarkup = renderToStaticMarkup(
    <AgentAnalyticsMetricCard
      label="Completed spend"
      value="0.25 USDC"
      description="USDC confirmed through trusted unlock completion."
    />,
  );
  assert.equal(cardMarkup.includes("0.25 USDC"), true);

  const trendMarkup = renderToStaticMarkup(
    <AgentExecutionTrend trend={[]} granularity="day" />,
  );
  assert.equal(trendMarkup.includes("No execution trend is available"), true);

  const breakdownMarkup = renderToStaticMarkup(
    <AgentDecisionBreakdown
      decisions={[
        { label: "BUY", count: 2, percentage: 0.67 },
        { label: "SKIP", count: 1, percentage: 0.33 },
      ]}
      statuses={[
        { label: "Completed", count: 1, percentage: 0.5 },
        { label: "Failed", count: 1, percentage: 0.5 },
      ]}
    />,
  );
  assert.equal(breakdownMarkup.includes("Decision breakdown"), true);
  assert.equal(breakdownMarkup.includes("BUY"), true);
  assert.equal(breakdownMarkup.includes("Completed"), true);

  const failureMarkup = renderToStaticMarkup(
    <AgentFailureBreakdown
      failures={[
        { label: "Payment", count: 1, percentage: 1 },
      ]}
    />,
  );
  assert.equal(failureMarkup.includes("Failure stages"), true);

  const goalsMarkup = renderToStaticMarkup(
    <AgentGoalBreakdown
      goals={[{ label: "Goal one", count: 2, percentage: 1 }]}
      categories={[{ label: "AI", count: 2, percentage: 1 }]}
    />,
  );
  assert.equal(goalsMarkup.includes("Recurring goals and categories"), true);

  const spendMarkup = renderToStaticMarkup(
    <AgentSpendSummary
      analytics={{
        spend: {
          submittedUSDC: "0.5",
          completedUSDC: "0.25",
          averageCompletedPurchaseUSDC: null,
        },
        performance: {
          averageExecutionDurationMs: 60000,
          medianExecutionDurationMs: 120000,
          averageRecommendationScore: null,
        },
      }}
    />,
  );
  assert.equal(spendMarkup.includes("Submitted spend"), true);
  assert.equal(spendMarkup.includes("Not enough data"), true);

  const resourcesMarkup = renderToStaticMarkup(
    <AgentTopResources
      resources={[
        {
          resourceId: "resource-1",
          title: "Persisted Resource",
          category: "AI",
          collection: "Research",
          recommendations: 2,
          completedPurchases: 1,
          completedSpendUSDC: "0.25",
        },
      ]}
    />,
  );
  assert.equal(resourcesMarkup.includes("/resource/resource-1"), true);
  assert.equal(resourcesMarkup.includes("Persisted Resource"), true);
});

function createAnalyticsMockClient() {
  const state = {
    users: [
      {
        id: "owner-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        id: "owner-2",
        walletAddress: "0x2222222222222222222222222222222222222222",
      },
    ],
    agents: [
      { id: "agent-1", ownerWallet: "0x1111111111111111111111111111111111111111" },
      { id: "agent-2", ownerWallet: "0x2222222222222222222222222222222222222222" },
    ],
    executions: [] as AnalyticsRow[],
  };

  const client: any = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return state.users.find((user) => user.id === where.id) ?? null;
      },
    },
    agent: {
      async findMany({ where }: { where: { ownerWallet: string } }) {
        return state.agents
          .filter((agent) => agent.ownerWallet === where.ownerWallet)
          .map((agent) => ({ id: agent.id }));
      },
    },
    agentExecution: {
      async findMany({
        where,
      }: {
        where?: Record<string, unknown>;
      }) {
        let rows = [...state.executions];
        const agentIds = getIdFilter(where?.agentId);
        if (agentIds) {
          rows = rows.filter((row) => agentIds.includes(row.agentId));
        }

        const startedAt = where?.startedAt as
          | {
              gte?: Date;
              lte?: Date;
            }
          | undefined;
        if (startedAt?.gte) {
          rows = rows.filter((row) => row.startedAt >= startedAt.gte!);
        }
        if (startedAt?.lte) {
          rows = rows.filter((row) => row.startedAt <= startedAt.lte!);
        }

        rows.sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
        return rows.map((row) => ({
          id: row.id,
          goal: row.goal,
          status: row.status,
          decision: row.decision,
          selectedResourceId: row.selectedResourceId,
          reasoning: row.reasoning,
          estimatedCostUSDC: row.estimatedCostUSDC,
          txHash: row.txHash,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        }));
      },
    },
  };

  return { client, state };
}

function getIdFilter(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as { in?: string[] };
  return Array.isArray(record.in) ? record.in : null;
}

function buildCompletedBuyRow(input: {
  id: string;
  goal: string;
  startedAt: Date;
  completedAt: Date;
  resourceId: string;
  title: string;
  category: string;
  collection: string;
  amountUSDC: number;
  matchScore: number;
  agentId?: string;
}): AnalyticsRow {
  return {
    id: input.id,
    agentId: input.agentId ?? "agent-1",
    goal: input.goal,
    status: "COMPLETED",
    decision: "BUY",
    selectedResourceId: input.resourceId,
    estimatedCostUSDC: input.amountUSDC,
    txHash: `0x${input.id}`,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    reasoning: {
      version: 1,
      goal: {
        originalGoal: input.goal,
        normalizedQuery: input.goal.toLowerCase(),
        keywords: ["agent", "toolkit"],
      },
      policy: {
        remainingBudgetUSDC: 1,
        maxPurchaseUSDC: 1,
        minimumMatchScore: 35,
      },
      normalizedGoal: input.goal.toLowerCase(),
      candidateCount: 1,
      candidateSummaries: [],
      selectedResource: {
        id: input.resourceId,
        title: input.title,
        description: "Description",
        priceUSDC: input.amountUSDC,
        resourceType: "CONTENT",
        aiSummary: "summary",
        aiTopics: ["agent"],
        aiCategory: input.category,
        aiCollection: input.collection,
        aiPlacement: "Featured",
        publishedAt: "2026-07-01T00:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      selectedEvaluation: {
        resource: {
          id: input.resourceId,
          title: input.title,
          description: "Description",
          priceUSDC: input.amountUSDC,
          resourceType: "CONTENT",
          aiSummary: "summary",
          aiTopics: ["agent"],
          aiCategory: input.category,
          aiCollection: input.collection,
          aiPlacement: "Featured",
          publishedAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        matchScore: input.matchScore,
        matchedKeywords: ["agent"],
        budgetEligible: true,
        reasons: ["Keyword match"],
      },
      comparisonSummary: {
        candidateCount: 1,
        budgetEligibleCount: 1,
        selectedCandidateId: input.resourceId,
        topMatchScore: input.matchScore,
        summary: "Selected candidate.",
      },
      trace: [],
      recommendation: {
        decision: "BUY",
        status: "COMPLETED",
      },
      purchase: {
        status: "COMPLETED",
        settlementStatus: "SETTLED",
        unlockStatus: "UNLOCKED",
        transactionId: `0x${input.id}`,
        amountUSDC: input.amountUSDC,
        resourceId: input.resourceId,
      },
      failure: null,
    },
  };
}

function buildSkipRow(input: {
  id: string;
  goal: string;
  startedAt: Date;
  topMatchScore: number;
  agentId?: string;
}): AnalyticsRow {
  return {
    id: input.id,
    agentId: input.agentId ?? "agent-1",
    goal: input.goal,
    status: "RECOMMENDED_SKIP",
    decision: "SKIP",
    selectedResourceId: null,
    estimatedCostUSDC: null,
    txHash: null,
    startedAt: input.startedAt,
    completedAt: null,
    reasoning: {
      version: 1,
      goal: {
        originalGoal: input.goal,
        normalizedQuery: input.goal.toLowerCase(),
        keywords: ["agent", "toolkit"],
      },
      policy: {
        remainingBudgetUSDC: 1,
        maxPurchaseUSDC: 1,
        minimumMatchScore: 35,
      },
      normalizedGoal: input.goal.toLowerCase(),
      candidateCount: 1,
      candidateSummaries: [],
      selectedResource: null,
      selectedEvaluation: null,
      comparisonSummary: {
        candidateCount: 1,
        budgetEligibleCount: 1,
        selectedCandidateId: null,
        topMatchScore: input.topMatchScore,
        summary: "No purchase was recommended.",
      },
      trace: [],
      recommendation: {
        decision: "SKIP",
        status: "RECOMMENDED_SKIP",
      },
      purchase: {
        status: "NOT_STARTED",
        settlementStatus: "NOT_STARTED",
        unlockStatus: "NOT_STARTED",
        transactionId: null,
        amountUSDC: null,
        resourceId: null,
      },
      failure: null,
    },
  };
}

function buildFailedPaymentRow(input: {
  id: string;
  goal: string;
  startedAt: Date;
  completedAt: Date;
  resourceId: string;
  title: string;
  category: string;
  collection: string;
  amountUSDC: number;
  matchScore: number;
  agentId?: string;
}): AnalyticsRow {
  const row = buildCompletedBuyRow(input);
  return {
    ...row,
    status: "FAILED",
    reasoning: {
      ...row.reasoning,
      purchase: {
        status: "FAILED",
        settlementStatus: "FAILED",
        unlockStatus: "FAILED",
        transactionId: `0x${input.id}`,
        amountUSDC: input.amountUSDC,
        resourceId: input.resourceId,
      },
      failure: {
        code: "PAYMENT_REJECTED",
        message: "Payment rejected by trusted server flow.",
        stage: "PAYMENT_SUBMITTED",
      },
    },
  };
}

function buildRunningRow(input: {
  id: string;
  goal: string;
  startedAt: Date;
  agentId?: string;
}): AnalyticsRow {
  return {
    id: input.id,
    agentId: input.agentId ?? "agent-1",
    goal: input.goal,
    status: "RUNNING",
    decision: null,
    selectedResourceId: null,
    estimatedCostUSDC: null,
    txHash: null,
    startedAt: input.startedAt,
    completedAt: null,
    reasoning: {
      version: 1,
      goal: {
        originalGoal: input.goal,
        normalizedQuery: input.goal.toLowerCase(),
        keywords: ["agent"],
      },
      policy: {
        remainingBudgetUSDC: 1,
        maxPurchaseUSDC: 1,
        minimumMatchScore: 35,
      },
      normalizedGoal: input.goal.toLowerCase(),
      candidateCount: 0,
      candidateSummaries: [],
      selectedResource: null,
      selectedEvaluation: null,
      comparisonSummary: {
        candidateCount: 0,
        budgetEligibleCount: 0,
        selectedCandidateId: null,
        topMatchScore: null,
        summary: "Execution created.",
      },
      trace: [],
      recommendation: {
        decision: "SKIP",
        status: "RUNNING",
      },
      purchase: {
        status: "NOT_STARTED",
        settlementStatus: "NOT_STARTED",
        unlockStatus: "NOT_STARTED",
        transactionId: null,
        amountUSDC: null,
        resourceId: null,
      },
      failure: null,
    },
  };
}
