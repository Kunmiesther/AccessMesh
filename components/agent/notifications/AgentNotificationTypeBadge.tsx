import type { AgentNotificationType } from "@/services/agent/AgentNotificationTypes";

export function AgentNotificationTypeBadge({
  type,
}: {
  type: AgentNotificationType;
}) {
  return <span style={badgeStyle}>{presentation[type].label}</span>;
}

const presentation: Record<AgentNotificationType, { label: string }> = {
  APPROVAL_REQUIRED: { label: "Approval" },
  EXECUTION_COMPLETED: { label: "Completed" },
  EXECUTION_FAILED: { label: "Failed" },
  PAYMENT_SUBMITTED: { label: "Payment" },
  SETTLEMENT_VERIFIED: { label: "Settlement" },
  UNLOCK_COMPLETED: { label: "Unlock" },
  SCHEDULE_PAUSED: { label: "Paused" },
  SCHEDULE_FAILED: { label: "Schedule failed" },
};

const badgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-secondary)",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "6px 9px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;
