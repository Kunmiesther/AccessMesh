export type AgentApprovalDecision = "APPROVED" | "REJECTED";

export type AgentApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "NO_LONGER_ACTIONABLE";

export type AgentApprovalSource = "MANUAL" | "SCHEDULED";

export type AgentApprovalRejectionReason =
  | "TOO_EXPENSIVE"
  | "LOW_CONFIDENCE"
  | "NOT_RELEVANT"
  | "NO_LONGER_NEEDED"
  | "OTHER";

export type AgentApprovalListFilter = "all" | "pending" | "resolved";

export const AGENT_APPROVAL_LIST_DEFAULT_LIMIT = 10;
export const AGENT_APPROVAL_LIST_MAX_LIMIT = 20;

export type AgentApprovalListCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

export type AgentApprovalListQuery = Readonly<{
  limit: number;
  cursor: AgentApprovalListCursor | null;
  status: AgentApprovalListFilter;
}>;

export type AgentApprovalListQueryInput = Readonly<{
  cursor?: string | null;
  limit?: string | null;
  status?: string | null;
}>;

export type AgentApprovalListQueryParseResult =
  | {
      ok: true;
      query: AgentApprovalListQuery;
    }
  | {
      ok: false;
      error: string;
    };

export type AgentApprovalRejectInput = Readonly<{
  reasonCode: AgentApprovalRejectionReason;
  reasonText: string | null;
}>;

export type AgentApprovalSummaryView = Readonly<{
  id: string;
  executionId: string;
  source: AgentApprovalSource;
  goal: string;
  policy: Readonly<{
    id: string | null;
    name: string;
    version: number | null;
  }>;
  resource: Readonly<{
    id: string | null;
    title: string;
    category: string | null;
  }>;
  recommendation: Readonly<{
    score: number | null;
    estimatedCostUSDC: string | null;
    comparisonSummary: string | null;
  }>;
  schedule: Readonly<{
    id: string;
    name: string;
  } | null>;
  approvalStatus: AgentApprovalStatus;
  decision: AgentApprovalDecision | null;
  reasonCode: AgentApprovalRejectionReason | null;
  reasonText: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}>;

export type AgentApprovalDetailView = AgentApprovalSummaryView & {
  status: AgentApprovalStatus;
};

export type AgentApprovalMutationResult = Readonly<{
  approval: AgentApprovalDetailView;
}>;
