export function AgentPolicyDefaultBadge() {
  return (
    <span style={badgeStyle} title="This is the default policy used for new agent runs">
      Default
    </span>
  );
}

const badgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  background: "rgba(0,194,168,0.08)",
  border: "1px solid rgba(0,194,168,0.25)",
  borderRadius: 999,
  padding: "7px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

