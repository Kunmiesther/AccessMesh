export type AgentBudgetPeriodType = "DAILY" | "MONTHLY";

export type AgentBudgetEntryType =
  | "RESERVATION"
  | "COMMITMENT"
  | "RELEASE"
  | "ADJUSTMENT";

export type AgentBudgetReservationStatus =
  | "ACTIVE"
  | "SUBMISSION_UNKNOWN"
  | "COMMITTED"
  | "RELEASED"
  | "EXPIRED";

export type AgentBudgetReleaseReason =
  | "CANCELLED_BEFORE_PAYMENT"
  | "RESERVATION_EXPIRED"
  | "EXECUTION_INVALIDATED"
  | "PAYMENT_NOT_SUBMITTED"
  | "OTHER";

export type AgentBudgetBucketView = Readonly<{
  bucketId: string | null;
  ownerId: string | null;
  policyId: string;
  policyName: string;
  policyVersion: number | null;
  status: "ACTIVE" | "ARCHIVED";
  periodType: AgentBudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  limitUSDC: string;
  committedUSDC: string;
  reservedUSDC: string;
  availableUSDC: string;
  activeReservationCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type AgentBudgetReservationView = Readonly<{
  id: string;
  bucketId: string;
  executionId: string;
  policyId: string;
  policyName: string;
  policyVersion: number | null;
  periodType: AgentBudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  amountUSDC: string;
  status: AgentBudgetReservationStatus;
  expiresAt: string | null;
  committedAt: string | null;
  releasedAt: string | null;
  releaseReason: AgentBudgetReleaseReason | null;
  createdAt: string;
  updatedAt: string;
}>;

export type AgentBudgetLedgerEntryView = Readonly<{
  id: string;
  bucketId: string;
  executionId: string | null;
  reservationId: string | null;
  type: AgentBudgetEntryType;
  amountUSDC: string;
  dedupeKey: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  policyId: string;
  policyName: string;
  policyVersion: number | null;
  periodType: AgentBudgetPeriodType;
  periodStart: string;
  periodEnd: string;
}>;

export type AgentBudgetActivityPage = Readonly<{
  entries: AgentBudgetLedgerEntryView[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

export type AgentBudgetSummaryView = Readonly<{
  policies: AgentBudgetBucketView[];
  totals: Readonly<{
    committedUSDC: string;
    reservedUSDC: string;
    availableUSDC: string;
    activeReservations: number;
  }>;
}>;

export type AgentBudgetReserveResult = Readonly<{
  bucket: AgentBudgetBucketView;
  reservation: AgentBudgetReservationView;
  activity?: AgentBudgetLedgerEntryView | null;
}>;

export type AgentBudgetCommitResult = Readonly<{
  bucket: AgentBudgetBucketView;
  reservation: AgentBudgetReservationView;
  activity?: AgentBudgetLedgerEntryView | null;
}>;

export type AgentBudgetReleaseResult = Readonly<{
  bucket: AgentBudgetBucketView;
  reservation: AgentBudgetReservationView;
  activity?: AgentBudgetLedgerEntryView | null;
}>;

export type AgentBudgetUnavailableError = Readonly<{
  code:
    | "BUDGET_INSUFFICIENT"
    | "RESERVATION_NOT_FOUND"
    | "RESERVATION_NOT_ACTIONABLE"
    | "RESERVATION_CONFLICT"
    | "RESERVATION_EXPIRED"
    | "POLICY_NOT_FOUND"
    | "EXECUTION_NOT_FOUND";
  message: string;
  details?: Record<string, unknown>;
}>;
