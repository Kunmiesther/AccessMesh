import type { AgentApprovalStatus } from "@/services/agent/AgentApprovalTypes";

type Tone = "neutral" | "info" | "positive" | "warning" | "danger";

const APPROVAL_STATUS_PRESENTATION: Record<
  AgentApprovalStatus,
  {
    label: string;
    description: string;
    tone: Tone;
  }
> = {
  PENDING: {
    label: "Pending",
    description: "The recommendation is waiting for owner review.",
    tone: "info",
  },
  APPROVED: {
    label: "Approved",
    description: "The owner approved the recommendation.",
    tone: "positive",
  },
  REJECTED: {
    label: "Rejected",
    description: "The owner rejected the recommendation.",
    tone: "warning",
  },
  EXPIRED: {
    label: "Expired",
    description: "The approval expired before it was acted on.",
    tone: "neutral",
  },
  NO_LONGER_ACTIONABLE: {
    label: "Closed",
    description: "The approval is no longer actionable.",
    tone: "danger",
  },
};

export function getApprovalStatusPresentation(status: AgentApprovalStatus) {
  return APPROVAL_STATUS_PRESENTATION[status];
}
