import type { AgentNotificationSummaryView, AgentNotificationType } from "./AgentNotificationTypes";

type AgentNotificationRow = {
  id: string;
  ownerId: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionPath: string | null;
  dedupeKey: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

export function toAgentNotificationSummary(
  notification: AgentNotificationRow,
): AgentNotificationSummaryView {
  return {
    id: notification.id,
    type: normalizeNotificationType(notification.type),
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionPath: notification.actionPath,
    isUnread: notification.readAt === null,
    readAt: toIsoOrNull(notification.readAt),
    createdAt: toIsoString(notification.createdAt),
  };
}

function normalizeNotificationType(value: string): AgentNotificationType {
  if (
    value === "APPROVAL_REQUIRED" ||
    value === "EXECUTION_COMPLETED" ||
    value === "EXECUTION_FAILED" ||
    value === "PAYMENT_SUBMITTED" ||
    value === "SETTLEMENT_VERIFIED" ||
    value === "UNLOCK_COMPLETED" ||
    value === "SCHEDULE_PAUSED" ||
    value === "SCHEDULE_FAILED"
  ) {
    return value;
  }

  return "EXECUTION_FAILED";
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toIsoOrNull(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return toIsoString(value);
}

