import { getAgentPolicyStatusPresentation } from "./policyPresentation";
import type { AgentPolicyStatus } from "@/services/agent/AgentPolicyTypes";

export function AgentPolicyStatusBadge({
  status,
}: {
  status: AgentPolicyStatus;
}) {
  const presentation = getAgentPolicyStatusPresentation(status);

  return (
    <span style={badgeStyle(presentation.tone)} title={presentation.description}>
      {presentation.label}
    </span>
  );
}

function badgeStyle(tone: "neutral" | "positive" | "warning") {
  const palette = {
    neutral: {
      color: "var(--text-secondary)",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--border)",
    },
    positive: {
      color: "var(--success)",
      background: "rgba(76,175,125,0.08)",
      border: "1px solid rgba(76,175,125,0.25)",
    },
    warning: {
      color: "var(--warning)",
      background: "rgba(200,151,42,0.08)",
      border: "1px solid rgba(200,151,42,0.25)",
    },
  }[tone];

  return {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: palette.color,
    background: palette.background,
    border: palette.border,
    borderRadius: 999,
    padding: "7px 10px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
  } as const;
}

