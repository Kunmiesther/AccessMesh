import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { AgentAnalyticsEmptyState } from "@/components/agent/analytics/AgentAnalyticsEmptyState";
import { AgentAnalyticsHeader } from "@/components/agent/analytics/AgentAnalyticsHeader";
import { AgentAnalyticsMetricCard } from "@/components/agent/analytics/AgentAnalyticsMetricCard";
import { AgentAnalyticsMetricGrid } from "@/components/agent/analytics/AgentAnalyticsMetricGrid";
import { AgentAnalyticsPeriodSelector } from "@/components/agent/analytics/AgentAnalyticsPeriodSelector";
import { AgentDecisionBreakdown } from "@/components/agent/analytics/AgentDecisionBreakdown";
import { AgentExecutionTrend } from "@/components/agent/analytics/AgentExecutionTrend";
import { AgentFailureBreakdown } from "@/components/agent/analytics/AgentFailureBreakdown";
import { AgentGoalBreakdown } from "@/components/agent/analytics/AgentGoalBreakdown";
import { AgentSpendSummary } from "@/components/agent/analytics/AgentSpendSummary";
import { AgentTopResources } from "@/components/agent/analytics/AgentTopResources";
import { formatPercentage } from "@/components/agent/analytics/formatters";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { formatUSDCAmount } from "@/components/agent/analytics/formatters";
import {
  AgentExecutionAnalyticsService,
  parseAgentAnalyticsPeriod,
} from "@/services/agent/AgentExecutionAnalytics";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AgentAnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const parsed = parseAgentAnalyticsPeriod(firstValue(searchParams?.period));

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        {owner ? (
          parsed.ok ? (
            <AnalyticsContent ownerId={owner.ownerId} period={parsed.period} />
          ) : (
            <StatePanel
              title="Malformed query"
              copy={parsed.error}
              actionHref="/agent/analytics"
              actionLabel="Reset analytics"
            />
          )
        ) : (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view private analytics."
            actionHref="/wallet?next=/agent/analytics"
            actionLabel="Connect Wallet"
          />
        )}
      </main>
    </div>
  );
}

async function AnalyticsContent({
  ownerId,
  period,
}: {
  ownerId: string;
  period: "7d" | "30d" | "90d" | "all";
}) {
  const service = new AgentExecutionAnalyticsService();
  const analytics = await service.getAnalyticsForOwner({
    ownerId,
    period,
  });

  return (
    <>
      <AgentAnalyticsHeader period={period} />
      <AgentAnalyticsPeriodSelector period={period} />

      {analytics.totals.executions === 0 ? (
        <AgentAnalyticsEmptyState />
      ) : (
        <>
          <section style={sectionPanelStyle} aria-label="Core metrics">
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Core metrics</p>
                <h2 style={sectionTitleStyle}>Execution summary</h2>
              </div>
              <p style={sectionCopyStyle}>
                Persisted totals from owner-scoped executions only. Spend values reflect trusted submission and unlock states.
              </p>
            </div>

            <AgentAnalyticsMetricGrid>
              <AgentAnalyticsMetricCard
                label="Executions"
                value={String(analytics.totals.executions)}
                description="All persisted agent runs in the selected period."
              />
              <AgentAnalyticsMetricCard
                label="BUY recommendation rate"
                value={formatRate(analytics.rates.buyRecommendationRate)}
                description="BUY recommendations divided by BUY and SKIP decisions only."
              />
              <AgentAnalyticsMetricCard
                label="Purchase conversion"
                value={formatRate(analytics.rates.purchaseConversionRate)}
                description="Executions that reached payment submission divided by BUY recommendations."
              />
              <AgentAnalyticsMetricCard
                label="Completed spend"
                value={formatUSDCAmount(analytics.spend.completedUSDC)}
                description="USDC confirmed through trusted unlock completion."
              />
              <AgentAnalyticsMetricCard
                label="Completion rate"
                value={formatRate(analytics.rates.completionRate)}
                description="Completed executions divided by all executions in the period."
              />
              <AgentAnalyticsMetricCard
                label="Failure rate"
                value={formatRate(analytics.rates.failureRate)}
                description="Failed executions divided by all executions in the period."
              />
            </AgentAnalyticsMetricGrid>
          </section>

          <AgentDecisionBreakdown
            decisions={analytics.breakdowns.decisions}
            statuses={analytics.breakdowns.statuses}
          />

          <AgentExecutionTrend
            trend={analytics.trend}
            granularity={analytics.trendGranularity}
          />

          <AgentSpendSummary analytics={analytics} />

          <AgentFailureBreakdown failures={analytics.breakdowns.failuresByStage} />

          <AgentGoalBreakdown
            goals={analytics.breakdowns.goals}
            categories={analytics.breakdowns.categories}
          />

          <AgentTopResources resources={analytics.breakdowns.resources} />

          <section style={footerPanelStyle} aria-label="Navigation">
            <div style={footerLinkRowStyle}>
              <Link href="/agent" style={footerLinkStyle}>
                Run Research Agent
              </Link>
              <Link href="/agent/history" style={footerLinkStyle}>
                View history
              </Link>
              <Link href="/agent/policies" style={footerLinkStyle}>
                View policies
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function StatePanel({
  title,
  copy,
  actionHref,
  actionLabel,
}: {
  title: string;
  copy: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section style={statePanelStyle}>
      <h1 style={stateTitleStyle}>{title}</h1>
      <p style={stateCopyStyle}>{copy}</p>
      <Link href={actionHref} style={actionStyle}>
        {actionLabel}
      </Link>
    </section>
  );
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatRate(value: number | null) {
  return value === null ? "Not enough data" : formatPercentage(value);
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 20,
} as const;

const statePanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 22,
  display: "grid",
  gap: 12,
} as const;

const stateTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const stateCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
} as const;

const actionStyle = {
  width: "fit-content",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;

const sectionPanelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const sectionTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const sectionCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
  maxWidth: 620,
} as const;

const footerPanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const footerLinkRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
} as const;

const footerLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;
