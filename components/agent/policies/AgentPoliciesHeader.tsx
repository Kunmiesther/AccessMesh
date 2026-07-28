import Link from "next/link";

export function AgentPoliciesHeader() {
  return (
    <header style={heroStyle}>
      <div style={copyStyle}>
        <p style={eyebrowStyle}>Agent Policies</p>
        <h1 style={titleStyle}>Agent Policies</h1>
        <p style={leadStyle}>
          Save reusable budget and recommendation rules for future agent runs.
        </p>
        <div style={actionsStyle}>
          <Link href="/agent/policies/new" style={primaryLinkStyle}>
            Create policy
          </Link>
          <Link href="/agent" style={secondaryLinkStyle}>
            Run agent
          </Link>
          <Link href="/agent/history" style={secondaryLinkStyle}>
            View history
          </Link>
          <Link href="/agent/analytics" style={secondaryLinkStyle}>
            View analytics
          </Link>
        </div>
      </div>
    </header>
  );
}

const heroStyle = {
  display: "grid",
  gap: 18,
} as const;

const copyStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 22,
  display: "grid",
  gap: 14,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const titleStyle = {
  fontSize: "clamp(32px, 5vw, 46px)",
  lineHeight: 1.08,
  color: "var(--text-primary)",
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.75,
  fontSize: 15,
  maxWidth: 760,
} as const;

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
} as const;

const primaryLinkStyle = {
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

const secondaryLinkStyle = {
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

