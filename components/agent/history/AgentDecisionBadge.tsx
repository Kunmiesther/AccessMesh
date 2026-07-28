import { getExecutionDecisionPresentation } from "./executionPresentation";
import type { AgentRecommendationDecision } from "@/services/agent/AgentExecutionTypes";

export function AgentDecisionBadge({
  decision,
}: {
  decision: AgentRecommendationDecision | null;
}) {
  const presentation = getExecutionDecisionPresentation(decision);

  if (!presentation) {
    return (
      <span style={badgeStyle("neutral")} title="No recommendation available">
        Unset
      </span>
    );
  }

  return (
    <span style={badgeStyle(presentation.tone)} title={`${presentation.label} recommendation`}>
      {presentation.label}
    </span>
  );
}

function badgeStyle(tone: "neutral" | "info" | "positive" | "warning" | "danger") {
  const palette = {
    neutral: {
      color: "var(--text-secondary)",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--border)",
    },
    info: {
      color: "var(--accent)",
      background: "rgba(0,194,168,0.08)",
      border: "1px solid rgba(0,194,168,0.28)",
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
    danger: {
      color: "var(--error)",
      background: "rgba(224,82,82,0.08)",
      border: "1px solid rgba(224,82,82,0.25)",
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
