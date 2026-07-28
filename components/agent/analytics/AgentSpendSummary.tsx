import { formatUSDCAmount } from "./formatters";
import type { AgentAnalyticsSummary } from "@/services/agent/AgentExecutionAnalytics";

export function AgentSpendSummary({
  analytics,
}: {
  analytics: Pick<AgentAnalyticsSummary, "spend" | "performance">;
}) {
  return (
    <section style={panelStyle} aria-label="Spend summary">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Spend</p>
          <h2 style={titleStyle}>USDC flow</h2>
        </div>
      </div>

      <div style={gridStyle}>
        <Card label="Submitted spend" value={formatUSDCAmount(analytics.spend.submittedUSDC)} />
        <Card label="Completed spend" value={formatUSDCAmount(analytics.spend.completedUSDC)} />
        <Card
          label="Average completed purchase"
          value={formatUSDCAmount(analytics.spend.averageCompletedPurchaseUSDC)}
        />
        <Card
          label="Average execution duration"
          value={formatDuration(analytics.performance.averageExecutionDurationMs)}
        />
        <Card
          label="Median execution duration"
          value={formatDuration(analytics.performance.medianExecutionDurationMs)}
        />
        <Card
          label="Average recommendation score"
          value={analytics.performance.averageRecommendationScore === null ? "Not enough data" : `${analytics.performance.averageRecommendationScore}/100`}
        />
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article style={cardStyle}>
      <p style={cardLabelStyle}>{label}</p>
      <p style={cardValueStyle}>{value}</p>
    </article>
  );
}

function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not enough data";
  }

  const totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

const panelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
  display: "grid",
  gap: 16,
} as const;

const headerStyle = {
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

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const gridStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
} as const;

const cardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 8,
} as const;

const cardLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const cardValueStyle = {
  color: "var(--text-primary)",
  fontSize: 22,
  lineHeight: 1.2,
  overflowWrap: "anywhere" as const,
} as const;

