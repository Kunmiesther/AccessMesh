import Link from "next/link";

export function AgentNotificationEmptyState({
  title = "No notifications yet",
  copy = "Important agent events will appear here when they are recorded.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={titleStyle}>{title}</h2>
      <p style={copyStyle}>{copy}</p>
      <Link href="/agent" style={actionStyle}>
        Run Research Agent
      </Link>
    </section>
  );
}

const panelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
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

const actionStyle = {
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
