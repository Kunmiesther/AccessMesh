import type {
  AgentAnalyticsGranularity,
  AgentAnalyticsTrendPoint,
} from "@/services/agent/AgentExecutionAnalytics";
import {
  formatTrendDateLabel,
  formatUSDCAmount,
} from "./formatters";

export function AgentExecutionTrend({
  trend,
  granularity,
}: {
  trend: AgentAnalyticsTrendPoint[];
  granularity: AgentAnalyticsGranularity;
}) {
  const maxValue = Math.max(
    1,
    ...trend.map((point) => Math.max(point.executions, point.completed, point.failed)),
  );

  return (
    <section style={panelStyle} aria-label="Execution trend">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Activity trend</p>
          <h2 style={titleStyle}>Execution trend</h2>
        </div>
        <p style={copyStyle}>
          {granularity === "month"
            ? "Monthly grouping is used for long all-time ranges."
            : "Daily grouping is used for the selected period."}
        </p>
      </div>

      {trend.length > 0 ? (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Executions</th>
                <th style={thStyle}>Completed</th>
                <th style={thStyle}>Failed</th>
                <th style={thStyle}>Completed spend</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.date}>
                  <td style={tdStyle} title={point.date}>
                    {formatTrendDateLabel(point.date, granularity)}
                  </td>
                  <td style={tdStyle}>
                    <BarValue value={point.executions} maxValue={maxValue} />
                  </td>
                  <td style={tdStyle}>
                    <BarValue value={point.completed} maxValue={maxValue} />
                  </td>
                  <td style={tdStyle}>
                    <BarValue value={point.failed} maxValue={maxValue} />
                  </td>
                  <td style={tdStyle}>{formatUSDCAmount(point.completedSpendUSDC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={emptyStyle}>No execution trend is available for this period.</p>
      )}

      {trend.length > 0 ? (
        <p style={helperStyle}>
          Each row reflects the persisted execution snapshots for that UTC bucket. The date labels are shown in your local timezone.
        </p>
      ) : null}
    </section>
  );
}

function BarValue({
  value,
  maxValue,
}: {
  value: number;
  maxValue: number;
}) {
  return (
    <span style={barValueStyle}>
      <span style={barTextStyle}>{value}</span>
      <span style={barTrackStyle} aria-hidden="true">
        <span
          style={{
            ...barFillStyle,
            width: `${Math.min(100, Math.max(0, (value / maxValue) * 100))}%`,
          }}
        />
      </span>
    </span>
  );
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

const copyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
  maxWidth: 520,
} as const;

const tableWrapStyle = {
  overflowX: "auto",
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
} as const;

const thStyle = {
  textAlign: "left" as const,
  padding: "12px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid var(--border-subtle)",
  whiteSpace: "nowrap" as const,
} as const;

const tdStyle = {
  padding: "14px 10px",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--text-primary)",
  verticalAlign: "middle",
} as const;

const barValueStyle = {
  display: "grid",
  gap: 8,
  minWidth: 140,
} as const;

const barTextStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
} as const;

const barTrackStyle = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  overflow: "hidden",
} as const;

const barFillStyle = {
  display: "block",
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(0,194,168,0.8), rgba(0,194,168,0.3))",
} as const;

const helperStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.6,
} as const;

const emptyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;
