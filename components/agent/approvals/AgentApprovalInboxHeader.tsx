import Link from "next/link";

export function AgentApprovalInboxHeader({
  pendingCount,
}: {
  pendingCount: number;
}) {
  return (
    <header style={headerStyle}>
      <div style={copyStyle}>
        <p style={eyebrowStyle}>Approval Inbox</p>
        <h1 style={titleStyle}>Review BUY recommendations before any payment is submitted.</h1>
        <p style={leadStyle}>
          Each approval item stays owner-scoped and references the same persisted execution record.
        </p>
      </div>

      <div style={actionRowStyle}>
        <span style={countPillStyle}>
          {pendingCount > 99 ? "99+" : String(pendingCount)} pending
        </span>
        <Link href="/agent" style={secondaryLinkStyle}>
          Run Agent
        </Link>
      </div>
    </header>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const copyStyle = {
  display: "grid",
  gap: 8,
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
  fontSize: "clamp(28px, 4vw, 40px)",
  lineHeight: 1.12,
  color: "var(--text-primary)",
  maxWidth: 780,
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
  maxWidth: 760,
} as const;

const actionRowStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
} as const;

const countPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  background: "rgba(0,194,168,0.08)",
  border: "1px solid rgba(0,194,168,0.25)",
  borderRadius: 999,
  padding: "8px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const secondaryLinkStyle = {
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
