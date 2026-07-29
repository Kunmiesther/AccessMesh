import type { AgentApprovalSource } from "@/services/agent/AgentApprovalTypes";

export function AgentApprovalSourceBadge({
  source,
}: {
  source: AgentApprovalSource;
}) {
  const label = source === "SCHEDULED" ? "Scheduled" : "Manual";

  return (
    <span style={badgeStyle(source === "SCHEDULED")} title={`${label} run`}>
      {label}
    </span>
  );
}

function badgeStyle(scheduled: boolean) {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: scheduled ? "var(--accent)" : "var(--text-secondary)",
    background: scheduled ? "rgba(0,194,168,0.08)" : "rgba(255,255,255,0.03)",
    border: scheduled ? "1px solid rgba(0,194,168,0.25)" : "1px solid var(--border)",
    borderRadius: 999,
    padding: "6px 9px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
  } as const;
}
