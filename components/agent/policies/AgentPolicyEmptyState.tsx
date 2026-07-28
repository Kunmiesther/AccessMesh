import Link from "next/link";

export function AgentPolicyEmptyState() {
  return (
    <section style={panelStyle} aria-label="No saved policies yet">
      <h2 style={titleStyle}>No saved policies yet</h2>
      <p style={copyStyle}>
        Create a reusable policy or start from a template.
      </p>
      <div style={actionsStyle}>
        <Link href="/agent/policies/new" style={primaryLinkStyle}>
          Create policy
        </Link>
        <Link href="/agent/policies/new?template=balanced-buyer" style={secondaryLinkStyle}>
          Use Balanced Buyer
        </Link>
      </div>
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

