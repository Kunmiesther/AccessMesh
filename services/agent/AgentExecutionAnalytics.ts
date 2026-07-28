import { sanitizeJsonValue } from "./AgentExecutionSerialization";
import type {
  AgentExecutionStatus,
  AgentRecommendationDecision,
  SerializableExecutionReasoning,
  SerializableResourceSnapshot,
} from "./AgentExecutionTypes";

export type AgentAnalyticsPeriod = "7d" | "30d" | "90d" | "all";

export type AgentAnalyticsGranularity = "day" | "month";

export type AgentAnalyticsTrendPoint = Readonly<{
  date: string;
  executions: number;
  buyRecommendations: number;
  skipRecommendations: number;
  completed: number;
  failed: number;
  completedSpendUSDC: string;
}>;

export type AnalyticsBreakdownItem = Readonly<{
  label: string;
  count: number;
  percentage: number | null;
}>;

export type AnalyticsResourceItem = Readonly<{
  resourceId: string | null;
  title: string;
  category: string | null;
  collection: string | null;
  recommendations: number;
  completedPurchases: number;
  completedSpendUSDC: string;
}>;

export type AgentAnalyticsSummary = Readonly<{
  period: Readonly<{
    from: string | null;
    to: string;
    preset: AgentAnalyticsPeriod;
  }>;
  trendGranularity: AgentAnalyticsGranularity;
  totals: Readonly<{
    executions: number;
    buyRecommendations: number;
    skipRecommendations: number;
    completedExecutions: number;
    failedExecutions: number;
    activeExecutions: number;
  }>;
  rates: Readonly<{
    buyRecommendationRate: number | null;
    completionRate: number | null;
    purchaseConversionRate: number | null;
    failureRate: number | null;
    unlockSuccessRate: number | null;
  }>;
  spend: Readonly<{
    submittedUSDC: string;
    completedUSDC: string;
    averageCompletedPurchaseUSDC: string | null;
  }>;
  performance: Readonly<{
    averageExecutionDurationMs: number | null;
    medianExecutionDurationMs: number | null;
    averageRecommendationScore: number | null;
  }>;
  breakdowns: Readonly<{
    decisions: AnalyticsBreakdownItem[];
    statuses: AnalyticsBreakdownItem[];
    failuresByStage: AnalyticsBreakdownItem[];
    goals: AnalyticsBreakdownItem[];
    resources: AnalyticsResourceItem[];
    categories: AnalyticsBreakdownItem[];
  }>;
  trend: AgentAnalyticsTrendPoint[];
}>;

export type AgentAnalyticsPeriodQueryResult =
  | {
      ok: true;
      period: AgentAnalyticsPeriod;
    }
  | {
      ok: false;
      error: string;
    };

type AnalyticsExecutionRow = Readonly<{
  id: string;
  goal: string;
  status: string;
  decision: AgentRecommendationDecision | null;
  selectedResourceId: string | null;
  reasoning: unknown;
  estimatedCostUSDC: number | null;
  txHash: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
}>;

type AgentExecutionAnalyticsClient = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { walletAddress: true };
    }): Promise<{ walletAddress: string } | null>;
  };
  agent: {
    findMany(args: {
      where: { ownerWallet: string };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
  agentExecution: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: Array<{ startedAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      select: Record<string, boolean>;
    }): Promise<AnalyticsExecutionRow[]>;
  };
};

const AGENT_EXECUTION_ANALYTICS_SELECT = {
  id: true,
  goal: true,
  status: true,
  decision: true,
  selectedResourceId: true,
  reasoning: true,
  estimatedCostUSDC: true,
  txHash: true,
  startedAt: true,
  completedAt: true,
} satisfies Record<string, boolean>;

const FIXED_PERIOD_DAY_COUNTS: Record<Exclude<AgentAnalyticsPeriod, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const ACTIVE_STATUSES = new Set<AgentExecutionStatus>([
  "CREATED",
  "RUNNING",
  "RECOMMENDED_BUY",
  "AWAITING_APPROVAL",
  "PAYMENT_SUBMITTED",
  "VERIFYING_SETTLEMENT",
  "UNLOCKING",
]);

const PAYMENT_PROGRESS_STATUSES = new Set<AgentExecutionStatus>([
  "PAYMENT_SUBMITTED",
  "VERIFYING_SETTLEMENT",
  "UNLOCKING",
  "COMPLETED",
]);

const DECISION_LABELS: Record<"BUY" | "SKIP" | "UNDECIDED", string> = {
  BUY: "BUY",
  SKIP: "SKIP",
  UNDECIDED: "Undecided",
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  RUNNING: "Running",
  RECOMMENDED_BUY: "Buy recommended",
  RECOMMENDED_SKIP: "Skipped",
  AWAITING_APPROVAL: "Awaiting approval",
  PAYMENT_SUBMITTED: "Payment submitted",
  VERIFYING_SETTLEMENT: "Verifying settlement",
  UNLOCKING: "Unlocking",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const FAILURE_STAGE_LABELS: Record<string, string> = {
  runtime: "Runtime",
  recommendation: "Recommendation",
  approval: "Approval",
  payment: "Payment",
  settlement: "Settlement",
  unlock: "Unlock",
  unknown: "Unknown",
};

export function parseAgentAnalyticsPeriod(
  value: string | null | undefined,
): AgentAnalyticsPeriodQueryResult {
  if (value === null || value === undefined || value === "") {
    return {
      ok: true,
      period: "30d",
    };
  }

  if (value === "7d" || value === "30d" || value === "90d" || value === "all") {
    return {
      ok: true,
      period: value,
    };
  }

  return {
    ok: false,
    error: "period is invalid",
  };
}

export class AgentExecutionAnalyticsService {
  constructor(private readonly clientFactory?: () => Promise<AgentExecutionAnalyticsClient>) {}

  async getAnalyticsForOwner(input: {
    ownerId: string;
    period?: AgentAnalyticsPeriod;
  }): Promise<AgentAnalyticsSummary> {
    const client = await this.getClient();
    const owner = await client.user.findUnique({
      where: { id: input.ownerId },
      select: { walletAddress: true },
    });

    const period = input.period ?? "30d";
    const periodBounds = buildPeriodBounds(period, new Date());

    if (!owner) {
      return buildEmptyAnalytics(periodBounds, period, "day");
    }

    const agents = await client.agent.findMany({
      where: { ownerWallet: owner.walletAddress },
      select: { id: true },
    });

    if (agents.length === 0) {
      return buildEmptyAnalytics(periodBounds, period, "day");
    }

    const startedAfter = periodBounds.from;
    const startedBefore = periodBounds.to;
    const rows = await client.agentExecution.findMany({
      where: buildAnalyticsWhere({
        agentIds: agents.map((agent) => agent.id),
        startedAfter,
        startedBefore,
      }),
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      select: AGENT_EXECUTION_ANALYTICS_SELECT,
    });

    return buildAgentAnalyticsSummary(rows, {
      period,
      periodBounds,
    });
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentExecutionAnalyticsClient;
  }
}

export function buildAgentAnalyticsSummary(
  rows: readonly AnalyticsExecutionRow[],
  input: {
    period: AgentAnalyticsPeriod;
    periodBounds: Readonly<{
      from: Date | null;
      to: Date;
    }>;
  },
): AgentAnalyticsSummary {
  const executions = [...rows];
  const trendGranularity = chooseTrendGranularity(input.period, executions, input.periodBounds);
  const periodFromIso = input.periodBounds.from ? input.periodBounds.from.toISOString() : null;
  const periodToIso = input.periodBounds.to.toISOString();

  const totals = {
    executions: executions.length,
    buyRecommendations: 0,
    skipRecommendations: 0,
    completedExecutions: 0,
    failedExecutions: 0,
    activeExecutions: 0,
  };

  const recommendationDenominator = {
    decided: 0,
    buy: 0,
  };

  const durationValues: number[] = [];
  const recommendationScoreValues: number[] = [];
  let unlockEligibleCount = 0;
  let unlockSuccessCount = 0;

  let submittedSpendMicros = BigInt(0);
  let completedSpendMicros = BigInt(0);
  let completedPurchaseCount = 0;

  const decisionCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  const failureStageCounts = new Map<string, number>();
  const goalCounts = new Map<string, number>();
  const resourceStats = new Map<
    string,
    {
      resourceId: string | null;
      title: string;
      category: string | null;
      collection: string | null;
      recommendations: number;
      completedPurchases: number;
      completedSpendMicros: bigint;
    }
  >();
  const categoryCounts = new Map<string, number>();
  const trendBuckets = new Map<string, TrendBucket>();

  for (const row of executions) {
    const reasoning = getReasoning(row.reasoning);
    const startedAt = toDate(row.startedAt);
    const completedAt = toOptionalDate(row.completedAt);
    const status = normalizeStatus(row.status);
    const decision = row.decision;

    if (status === "COMPLETED") {
      totals.completedExecutions += 1;
    }

    if (status === "FAILED") {
      totals.failedExecutions += 1;
    }

    if (ACTIVE_STATUSES.has(status)) {
      totals.activeExecutions += 1;
    }

    if (decision === "BUY") {
      totals.buyRecommendations += 1;
      recommendationDenominator.buy += 1;
      recommendationDenominator.decided += 1;
    } else if (decision === "SKIP") {
      totals.skipRecommendations += 1;
      recommendationDenominator.decided += 1;
    }

    decisionCounts.set(decision ?? "UNDECIDED", (decisionCounts.get(decision ?? "UNDECIDED") ?? 0) + 1);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    const goalLabel = normalizeGoalLabel(reasoning?.goal?.originalGoal ?? row.goal);
    goalCounts.set(goalLabel, (goalCounts.get(goalLabel) ?? 0) + 1);

    const selectedResource = getSelectedResource(reasoning, row.selectedResourceId);
    const resourceKey = selectedResource?.id ?? row.selectedResourceId ?? selectedResource?.title ?? "unknown";
    const resourceTitle = normalizeResourceTitle(selectedResource, row.selectedResourceId);
    const resourceCategory = normalizeResourceCategory(selectedResource);
    const resourceCollection = normalizeResourceCollection(selectedResource);

    if (decision === "BUY") {
      const selectedEvaluation = reasoning?.selectedEvaluation ?? null;
      if (selectedEvaluation && Number.isFinite(selectedEvaluation.matchScore)) {
        recommendationScoreValues.push(selectedEvaluation.matchScore);
      }
    } else if (decision === "SKIP") {
      const topMatchScore = reasoning?.comparisonSummary?.topMatchScore ?? null;
      if (typeof topMatchScore === "number" && Number.isFinite(topMatchScore)) {
        recommendationScoreValues.push(topMatchScore);
      }
    }

    const purchase = reasoning?.purchase ?? null;
    const completedSpent = shouldCountCompletedSpend(status, reasoning);

    if (didReachPaymentSubmission(status, reasoning)) {
      submittedSpendMicros += toUsdcMicros(purchase?.amountUSDC ?? row.estimatedCostUSDC);
    }

    if (completedSpent) {
      const amountMicros = toUsdcMicros(purchase?.amountUSDC ?? row.estimatedCostUSDC);
      completedSpendMicros += amountMicros;
      completedPurchaseCount += 1;
    }

    if (status === "COMPLETED" && completedAt && startedAt) {
      durationValues.push(completedAt.getTime() - startedAt.getTime());
    }

    if (didReachUnlockProcessing(status, reasoning)) {
      unlockEligibleCount += 1;
      if (status === "COMPLETED" && purchase?.unlockStatus === "UNLOCKED") {
        unlockSuccessCount += 1;
      }
    }

    if (reasoning?.failure?.stage) {
      const normalizedStage = normalizeFailureStage(reasoning.failure.stage);
      failureStageCounts.set(
        normalizedStage,
        (failureStageCounts.get(normalizedStage) ?? 0) + 1,
      );
    }

    if (decision === "BUY") {
      const resourceEntry = getOrCreateResourceStat(resourceStats, resourceKey, resourceTitle, resourceCategory, resourceCollection);
      resourceEntry.recommendations += 1;
      if (status === "COMPLETED") {
        resourceEntry.completedPurchases += 1;
        resourceEntry.completedSpendMicros += toUsdcMicros(purchase?.amountUSDC ?? row.estimatedCostUSDC);
      }
    } else if (decision === "SKIP") {
      if (selectedResource) {
        const resourceEntry = getOrCreateResourceStat(resourceStats, resourceKey, resourceTitle, resourceCategory, resourceCollection);
        resourceEntry.recommendations += 1;
      }
    }

    if (selectedResource) {
      const categoryLabel = normalizeCategoryLabel(selectedResource);
      categoryCounts.set(categoryLabel, (categoryCounts.get(categoryLabel) ?? 0) + 1);
    }

    const bucketKey = getTrendBucketKey(startedAt, trendGranularity);
    const bucket = trendBuckets.get(bucketKey) ?? createTrendBucket(bucketKey);
    bucket.executions += 1;
    if (decision === "BUY") {
      bucket.buyRecommendations += 1;
    } else if (decision === "SKIP") {
      bucket.skipRecommendations += 1;
    }
    if (status === "COMPLETED") {
      bucket.completed += 1;
      bucket.completedSpendMicros += toUsdcMicros(purchase?.amountUSDC ?? row.estimatedCostUSDC);
    }
    if (status === "FAILED") {
      bucket.failed += 1;
    }
    trendBuckets.set(bucketKey, bucket);
  }

  const trend = buildTrendSeries(trendBuckets, input.period, input.periodBounds, trendGranularity);

  const averageExecutionDurationMs = durationValues.length > 0
    ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
    : null;
  const medianExecutionDurationMs = durationValues.length > 0
    ? calculateMedian(durationValues)
    : null;

  const averageRecommendationScore = recommendationScoreValues.length > 0
    ? roundToSingleDecimal(
        recommendationScoreValues.reduce((sum, value) => sum + value, 0) /
          recommendationScoreValues.length,
      )
    : null;

  const totalCompletedSpend = microsToUsdcString(completedSpendMicros);
  const averageCompletedPurchaseUSDC = completedPurchaseCount > 0
    ? microsToUsdcString(completedSpendMicros / BigInt(completedPurchaseCount))
    : null;

  return {
    period: {
      from: periodFromIso,
      to: periodToIso,
      preset: input.period,
    },
    trendGranularity,
    totals,
    rates: {
      buyRecommendationRate:
        recommendationDenominator.decided > 0
          ? totals.buyRecommendations / recommendationDenominator.decided
          : null,
      completionRate:
        totals.executions > 0
          ? totals.completedExecutions / totals.executions
          : null,
      purchaseConversionRate:
        totals.buyRecommendations > 0
          ? countExecutionsWithPaymentSubmitted(executions) / totals.buyRecommendations
          : null,
      failureRate:
        totals.executions > 0
          ? totals.failedExecutions / totals.executions
          : null,
      unlockSuccessRate:
        unlockEligibleCount > 0
          ? unlockSuccessCount / unlockEligibleCount
          : null,
    },
    spend: {
      submittedUSDC: microsToUsdcString(submittedSpendMicros),
      completedUSDC: totalCompletedSpend,
      averageCompletedPurchaseUSDC,
    },
    performance: {
      averageExecutionDurationMs,
      medianExecutionDurationMs,
      averageRecommendationScore,
    },
    breakdowns: {
      decisions: buildBreakdownItems(decisionCounts, totals.executions, (key) =>
        key === "UNDECIDED" ? DECISION_LABELS.UNDECIDED : key,
      ),
      statuses: buildBreakdownItems(statusCounts, totals.executions, (key) =>
        STATUS_LABELS[key] ?? key,
      ),
      failuresByStage: buildBreakdownItems(
        failureStageCounts,
        totalCount(failureStageCounts),
        (key) => FAILURE_STAGE_LABELS[key] ?? key,
      ),
      goals: buildBreakdownItems(goalCounts, totals.executions, (key) => key),
      resources: [...resourceStats.values()]
        .sort((left, right) => {
          if (right.recommendations !== left.recommendations) {
            return right.recommendations - left.recommendations;
          }

          if (right.completedPurchases !== left.completedPurchases) {
            return right.completedPurchases - left.completedPurchases;
          }

          return left.title.localeCompare(right.title);
        })
        .slice(0, 10)
        .map((item) => ({
          resourceId: item.resourceId,
          title: item.title,
          category: item.category,
          collection: item.collection,
          recommendations: item.recommendations,
          completedPurchases: item.completedPurchases,
          completedSpendUSDC: microsToUsdcString(item.completedSpendMicros),
        })),
      categories: buildBreakdownItems(categoryCounts, totals.executions, (key) => key),
    },
    trend,
  };
}

function buildEmptyAnalytics(
  periodBounds: Readonly<{
    from: Date | null;
    to: Date;
  }>,
  period: AgentAnalyticsPeriod,
  trendGranularity: AgentAnalyticsGranularity,
): AgentAnalyticsSummary {
  return {
    period: {
      from: periodBounds.from ? periodBounds.from.toISOString() : null,
      to: periodBounds.to.toISOString(),
      preset: period,
    },
    trendGranularity,
    totals: {
      executions: 0,
      buyRecommendations: 0,
      skipRecommendations: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      activeExecutions: 0,
    },
    rates: {
      buyRecommendationRate: null,
      completionRate: null,
      purchaseConversionRate: null,
      failureRate: null,
      unlockSuccessRate: null,
    },
    spend: {
      submittedUSDC: "0",
      completedUSDC: "0",
      averageCompletedPurchaseUSDC: null,
    },
    performance: {
      averageExecutionDurationMs: null,
      medianExecutionDurationMs: null,
      averageRecommendationScore: null,
    },
    breakdowns: {
      decisions: [],
      statuses: [],
      failuresByStage: [],
      goals: [],
      resources: [],
      categories: [],
    },
    trend: [],
  };
}

function buildAnalyticsWhere(params: {
  agentIds: string[];
  startedAfter: Date | null;
  startedBefore: Date;
}) {
  const where: Record<string, unknown> = {
    agentId: { in: params.agentIds },
  };

  if (params.startedAfter || params.startedBefore) {
    where.startedAt = {};
    if (params.startedAfter) {
      (where.startedAt as Record<string, unknown>).gte = params.startedAfter;
    }
    (where.startedAt as Record<string, unknown>).lte = params.startedBefore;
  }

  return where;
}

function buildTrendSeries(
  trendBuckets: Map<string, TrendBucket>,
  period: AgentAnalyticsPeriod,
  periodBounds: Readonly<{
    from: Date | null;
    to: Date;
  }>,
  trendGranularity: AgentAnalyticsGranularity,
): AgentAnalyticsTrendPoint[] {
  if (trendGranularity === "month") {
    return buildMonthlyTrendSeries(trendBuckets, periodBounds);
  }

  if (period === "all" && !periodBounds.from) {
    return [];
  }

  const start = periodBounds.from ?? startOfUtcDay(periodBounds.to);
  const end = startOfUtcDay(periodBounds.to);
  const points: AgentAnalyticsTrendPoint[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const key = formatUtcDateKey(cursor);
    const bucket = trendBuckets.get(key);
    points.push(
      toTrendPoint(
        key,
        bucket ?? createTrendBucket(key),
      ),
    );
  }

  return points;
}

function buildMonthlyTrendSeries(
  trendBuckets: Map<string, TrendBucket>,
  periodBounds: Readonly<{
    from: Date | null;
    to: Date;
  }>,
) {
  if (!periodBounds.from) {
    return [];
  }

  const end = startOfUtcMonth(periodBounds.to);
  const maxMonths = 24;
  const earliest = startOfUtcMonth(periodBounds.from);
  const latestAllowedStart = addUtcMonths(end, -(maxMonths - 1));
  const start = earliest > latestAllowedStart ? earliest : latestAllowedStart;
  const points: AgentAnalyticsTrendPoint[] = [];
  let count = 0;

  for (let cursor = new Date(start); cursor <= end && count < maxMonths; cursor = addUtcMonths(cursor, 1)) {
    const key = formatUtcMonthKey(cursor);
    const bucket = trendBuckets.get(key);
    points.push(
      toTrendPoint(
        key,
        bucket ?? createTrendBucket(key),
      ),
    );
    count += 1;
  }

  return points;
}

function chooseTrendGranularity(
  period: AgentAnalyticsPeriod,
  rows: readonly AnalyticsExecutionRow[],
  periodBounds: Readonly<{
    from: Date | null;
    to: Date;
  }>,
): AgentAnalyticsGranularity {
  if (period !== "all") {
    return "day";
  }

  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  if (!firstRow || !lastRow) {
    return "day";
  }

  const spanDays = Math.max(
    1,
    Math.ceil(
      (toDate(lastRow.startedAt).getTime() - toDate(firstRow.startedAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );

  if (spanDays <= 120) {
    return "day";
  }

  return "month";
}

function getTrendBucketKey(date: Date, granularity: AgentAnalyticsGranularity) {
  return granularity === "month" ? formatUtcMonthKey(date) : formatUtcDateKey(date);
}

function createTrendBucket(date: string): TrendBucket {
  return {
    date,
    executions: 0,
    buyRecommendations: 0,
    skipRecommendations: 0,
    completed: 0,
    failed: 0,
    completedSpendMicros: BigInt(0),
  };
}

function toTrendPoint(date: string, bucket: TrendBucket): AgentAnalyticsTrendPoint {
  return {
    date,
    executions: bucket.executions,
    buyRecommendations: bucket.buyRecommendations,
    skipRecommendations: bucket.skipRecommendations,
    completed: bucket.completed,
    failed: bucket.failed,
    completedSpendUSDC: microsToUsdcString(bucket.completedSpendMicros),
  };
}

type TrendBucket = {
  date: string;
  executions: number;
  buyRecommendations: number;
  skipRecommendations: number;
  completed: number;
  failed: number;
  completedSpendMicros: bigint;
};

function getOrCreateResourceStat(
  map: Map<
    string,
    {
      resourceId: string | null;
      title: string;
      category: string | null;
      collection: string | null;
      recommendations: number;
      completedPurchases: number;
      completedSpendMicros: bigint;
    }
  >,
  key: string,
  title: string,
  category: string | null,
  collection: string | null,
) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const next = {
    resourceId: key === "unknown" ? null : key,
    title,
    category,
    collection,
    recommendations: 0,
    completedPurchases: 0,
    completedSpendMicros: BigInt(0),
  };
  map.set(key, next);
  return next;
}

function buildBreakdownItems(
  map: Map<string, number>,
  total: number,
  labelMap: (key: string) => string,
): AnalyticsBreakdownItem[] {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return labelMap(left[0]).localeCompare(labelMap(right[0]));
    })
    .slice(0, 10)
      .map(([key, count]) => ({
        label: labelMap(key),
        count,
      percentage: total > 0 ? count / total : null,
      }));
}

function totalCount(map: Map<string, number>) {
  let total = 0;
  for (const count of map.values()) {
    total += count;
  }
  return total;
}

function countExecutionsWithPaymentSubmitted(rows: readonly AnalyticsExecutionRow[]) {
  let count = 0;
  for (const row of rows) {
    const reasoning = getReasoning(row.reasoning);
    const status = normalizeStatus(row.status);
    if (didReachPaymentSubmission(status, reasoning)) {
      count += 1;
    }
  }
  return count;
}

function didReachPaymentSubmission(status: AgentExecutionStatus, reasoning: SerializableExecutionReasoning | null) {
  if (PAYMENT_PROGRESS_STATUSES.has(status)) {
    return true;
  }

  if (status === "FAILED") {
    const failureStage = normalizeFailureStage(reasoning?.failure?.stage ?? null);
    return failureStage === "payment" || failureStage === "settlement" || failureStage === "unlock";
  }

  return false;
}

function shouldCountCompletedSpend(status: AgentExecutionStatus, reasoning: SerializableExecutionReasoning | null) {
  if (status === "COMPLETED") {
    return true;
  }

  return reasoning?.purchase?.status === "COMPLETED" && reasoning?.purchase?.unlockStatus === "UNLOCKED";
}

function didReachUnlockProcessing(status: AgentExecutionStatus, reasoning: SerializableExecutionReasoning | null) {
  if (status === "UNLOCKING" || status === "COMPLETED") {
    return true;
  }

  if (status !== "FAILED") {
    return false;
  }

  const failureStage = normalizeFailureStage(reasoning?.failure?.stage ?? null);
  return failureStage === "unlock" || failureStage === "settlement";
}

function normalizeStatus(status: string): AgentExecutionStatus {
  return status as AgentExecutionStatus;
}

function normalizeGoalLabel(goal: string) {
  const trimmed = goal.trim();
  return trimmed.length > 0 ? trimmed : "Untitled goal";
}

function normalizeResourceTitle(
  resource: SerializableResourceSnapshot | null,
  resourceId: string | null,
) {
  if (resource?.title && resource.title.trim().length > 0) {
    return resource.title;
  }

  if (resourceId) {
    return "Unknown resource";
  }

  return "Unknown resource";
}

function normalizeResourceCategory(resource: SerializableResourceSnapshot | null) {
  if (!resource) {
    return null;
  }

  if (typeof resource.aiCategory === "string" && resource.aiCategory.trim().length > 0) {
    return resource.aiCategory;
  }

  if (typeof resource.resourceType === "string" && resource.resourceType.trim().length > 0) {
    return resource.resourceType;
  }

  return null;
}

function normalizeResourceCollection(resource: SerializableResourceSnapshot | null) {
  if (!resource) {
    return null;
  }

  if (typeof resource.aiCollection === "string" && resource.aiCollection.trim().length > 0) {
    return resource.aiCollection;
  }

  if (typeof resource.aiPlacement === "string" && resource.aiPlacement.trim().length > 0) {
    return resource.aiPlacement;
  }

  return null;
}

function normalizeCategoryLabel(resource: SerializableResourceSnapshot) {
  return normalizeResourceCategory(resource) ?? "Uncategorized";
}

function getSelectedResource(
  reasoning: SerializableExecutionReasoning | null,
  resourceId: string | null,
) {
  if (reasoning?.selectedResource) {
    return reasoning.selectedResource;
  }

  if (!resourceId) {
    return null;
  }

  return null;
}

function getReasoning(value: unknown): SerializableExecutionReasoning | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const normalized = sanitizeJsonValue(value) as Record<string, unknown>;
  if (normalized.version !== 1) {
    return null;
  }

  return normalized as SerializableExecutionReasoning;
}

function normalizeFailureStage(stage: string | null | undefined) {
  if (!stage) {
    return "unknown";
  }

  const normalized = stage.trim().toUpperCase();
  if (
    normalized === "CREATED" ||
    normalized === "RUNNING" ||
    normalized === "RUNTIME" ||
    normalized === "EXECUTION" ||
    normalized === "AGENT_RUNTIME"
  ) {
    return "runtime";
  }

  if (
    normalized === "RECOMMENDATION" ||
    normalized === "RECOMMENDED_BUY" ||
    normalized === "RECOMMENDED_SKIP" ||
    normalized === "BUY_RECOMMENDATION" ||
    normalized === "SKIP_RECOMMENDATION"
  ) {
    return "recommendation";
  }

  if (normalized === "AWAITING_APPROVAL" || normalized === "APPROVAL") {
    return "approval";
  }

  if (
    normalized === "PAYMENT" ||
    normalized === "PAYMENT_SUBMITTED" ||
    normalized === "SUBMITTED" ||
    normalized === "PAYMENT_FAILED"
  ) {
    return "payment";
  }

  if (
    normalized === "VERIFYING_SETTLEMENT" ||
    normalized === "SETTLEMENT" ||
    normalized === "SETTLEMENT_VERIFICATION"
  ) {
    return "settlement";
  }

  if (normalized === "UNLOCKING" || normalized === "UNLOCK" || normalized === "UNLOCK_FAILED") {
    return "unlock";
  }

  return "unknown";
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function calculateMedian(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }

  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left === undefined || right === undefined) {
    return null;
  }

  return Math.round((left + right) / 2);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toOptionalDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = toDate(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function buildPeriodBounds(period: AgentAnalyticsPeriod, now: Date) {
  const to = new Date(now);
  if (period === "all") {
    return {
      from: null,
      to,
    };
  }

  const days = FIXED_PERIOD_DAY_COUNTS[period];
  const from = startOfUtcDay(addUtcDays(now, -(days - 1)));
  return {
    from,
    to,
  };
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function formatUtcDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatUtcMonthKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function toUsdcMicros(value: unknown) {
  if (value === null || value === undefined) {
    return BigInt(0);
  }

  const normalized =
    typeof value === "number" || typeof value === "string"
      ? String(value).trim()
      : typeof value === "bigint"
        ? value.toString()
        : null;

  if (!normalized) {
    return BigInt(0);
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return BigInt(0);
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const micros =
    BigInt(wholePart || "0") * BigInt(1000000) +
    BigInt((fractionPart + "000000").slice(0, 6));
  return negative ? -micros : micros;
}

function microsToUsdcString(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const whole = absolute / BigInt(1000000);
  const fraction = absolute % BigInt(1000000);
  const fractionText = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  const combined = fractionText.length > 0 ? `${whole.toString()}.${fractionText}` : whole.toString();
  return negative && combined !== "0" ? `-${combined}` : combined;
}
