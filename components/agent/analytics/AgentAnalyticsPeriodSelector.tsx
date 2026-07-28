import type { AgentAnalyticsPeriod } from "@/services/agent/AgentExecutionAnalytics";
import { ANALYTICS_PERIOD_OPTIONS } from "./analyticsPresentation";

export function AgentAnalyticsPeriodSelector({
  period,
}: {
  period: AgentAnalyticsPeriod;
}) {
  return (
    <section style={panelStyle} aria-label="Analytics period">
      <form method="get" style={formStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Period</span>
          <select name="period" defaultValue={period} style={selectStyle}>
            {ANALYTICS_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" style={buttonStyle}>
          Update analytics
        </button>
      </form>
    </section>
  );
}

const panelStyle = {
  borderRadius: 18,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 16,
} as const;

const formStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "end",
} as const;

const fieldStyle = {
  display: "grid",
  gap: 8,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const selectStyle = {
  minWidth: 220,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
} as const;

const buttonStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

