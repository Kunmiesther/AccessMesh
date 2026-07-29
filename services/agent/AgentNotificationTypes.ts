export type AgentNotificationType =
  | "APPROVAL_REQUIRED"
  | "EXECUTION_COMPLETED"
  | "EXECUTION_FAILED"
  | "PAYMENT_SUBMITTED"
  | "SETTLEMENT_VERIFIED"
  | "UNLOCK_COMPLETED"
  | "SCHEDULE_PAUSED"
  | "SCHEDULE_FAILED";

export type AgentNotificationFilter = "all" | "unread";

export type AgentNotificationSummaryView = Readonly<{
  id: string;
  type: AgentNotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionPath: string | null;
  isUnread: boolean;
  readAt: string | null;
  createdAt: string;
}>;

export type AgentNotificationPage = Readonly<{
  notifications: AgentNotificationSummaryView[];
  nextCursor: string | null;
  hasMore: boolean;
}>;

export type AgentNotificationUnreadCount = Readonly<{
  count: number;
}>;
