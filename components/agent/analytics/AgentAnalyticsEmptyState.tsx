import Link from "next/link";

export function AgentAnalyticsEmptyState() {
  return (
    <section style={panelStyle} aria-label="Empty analytics state">
      <h2 style={titleStyle}>No agent activity in this period</h2>
      <p style={copyStyle}>
        Run the Research Agent or choose a broader period to view analytics.
      </p>
      <div style={actionRowStyle}>
        <Link href="/agent" style={buttonStyle}>
          Run the Research Agent
        </Link>
        <Link href="/agent/history" style={secondaryButtonStyle}>
          View history
        </Link>
      </div>
    </section>
  );
}

const panelStyle = {
  borderRadius: 20,
  border: "1px dashed var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 22,
  display: "grid",
  gap: 12,
} as const;

const titleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const copyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
} as const;

const actionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
} as const;

const buttonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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

const secondaryButtonStyle = {
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

