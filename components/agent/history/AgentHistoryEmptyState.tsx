import Link from "next/link";

export function AgentHistoryEmptyState({
  title = "No agent executions yet",
  copy = "Run the Research Agent to create your first execution record.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={titleStyle}>{title}</h2>
      <p style={copyStyle}>{copy}</p>
      <Link href="/agent" style={buttonStyle}>
        Run the Research Agent
      </Link>
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
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const copyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
} as const;

const buttonStyle = {
  width: "fit-content",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const;
