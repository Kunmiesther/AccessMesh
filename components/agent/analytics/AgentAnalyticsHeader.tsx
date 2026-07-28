import Link from "next/link";
import { ANALYTICS_PERIOD_OPTIONS } from "./analyticsPresentation";
import type { AgentAnalyticsPeriod } from "@/services/agent/AgentExecutionAnalytics";

export function AgentAnalyticsHeader({
  period,
}: {
  period: AgentAnalyticsPeriod;
}) {
  return (
    <header style={headerStyle}>
      <div style={copyStyle}>
        <p style={eyebrowStyle}>Agent Analytics</p>
        <h1 style={titleStyle}>Agent Analytics</h1>
        <p style={leadStyle}>
          Review run frequency, recommendations, completed purchases, spend, failures, and recurring goals from persisted executions only.
        </p>
      </div>

      <div style={actionRowStyle}>
        <Link href="/agent" style={secondaryActionStyle}>
          Run Agent
        </Link>
        <Link href="/agent/history" style={secondaryActionStyle}>
          History
        </Link>
        <span style={periodPillStyle}>
          {ANALYTICS_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Last 30 days"}
        </span>
      </div>
    </header>
  );
}

const headerStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 22,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-start",
} as const;

const copyStyle = {
  display: "grid",
  gap: 12,
  minWidth: 0,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const titleStyle = {
  fontSize: "clamp(30px, 4.8vw, 44px)",
  lineHeight: 1.08,
  color: "var(--text-primary)",
  overflowWrap: "anywhere" as const,
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
  maxWidth: 840,
} as const;

const actionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
} as const;

const secondaryActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "10px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;

const periodPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  borderRadius: 999,
  border: "1px solid rgba(0,194,168,0.25)",
  background: "rgba(0,194,168,0.08)",
  padding: "8px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

