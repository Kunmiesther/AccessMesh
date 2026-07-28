import type { AnalyticsBreakdownItem } from "@/services/agent/AgentExecutionAnalytics";
import { formatPercentage } from "./formatters";

export function AgentGoalBreakdown({
  goals,
  categories,
}: {
  goals: AnalyticsBreakdownItem[];
  categories: AnalyticsBreakdownItem[];
}) {
  return (
    <section style={panelStyle} aria-label="Goals and categories">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Goals and categories</p>
          <h2 style={titleStyle}>Recurring goals and categories</h2>
        </div>
      </div>

      <div style={gridStyle}>
        <BreakdownCard title="Goals" items={goals} />
        <BreakdownCard title="Categories" items={categories} />
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: AnalyticsBreakdownItem[];
}) {
  return (
    <article style={cardStyle}>
      <h3 style={cardTitleStyle}>{title}</h3>
      {items.length > 0 ? (
        <ul style={listStyle}>
          {items.map((item) => (
            <li key={item.label} style={itemStyle}>
              <div style={itemHeaderStyle}>
                <span style={itemLabelStyle}>{item.label}</span>
                <span style={itemCountStyle}>
                  {item.count}
                  {item.percentage !== null ? ` · ${formatPercentage(item.percentage)}` : ""}
                </span>
              </div>
              <div style={barTrackStyle} aria-hidden="true">
                <span
                  style={{
                    ...barFillStyle,
                    width: item.percentage === null ? "0%" : `${Math.max(4, item.percentage * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={emptyStyle}>No data in this period.</p>
      )}
    </article>
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

const gridStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
} as const;

const cardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 12,
} as const;

const cardTitleStyle = {
  fontSize: 14,
  color: "var(--text-primary)",
} as const;

const listStyle = {
  listStyle: "none",
  display: "grid",
  gap: 10,
} as const;

const itemStyle = {
  display: "grid",
  gap: 6,
} as const;

const itemHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
  flexWrap: "wrap",
} as const;

const itemLabelStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const itemCountStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  whiteSpace: "nowrap" as const,
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
  background: "linear-gradient(90deg, rgba(0,194,168,0.8), rgba(0,194,168,0.35))",
} as const;

const emptyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;
