import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getApprovals } from "../../app/api/agent/approvals/route";
import { POST as approveApproval } from "../../app/api/agent/approvals/[id]/approve/route";
import { POST as rejectApproval } from "../../app/api/agent/approvals/[id]/reject/route";
import { GET as getNotifications } from "../../app/api/agent/notifications/route";
import { GET as getUnreadCount } from "../../app/api/agent/notifications/unread-count/route";
import {
  createAgentOwnerSessionPayload,
  encodeAgentOwnerSession,
} from "../../lib/auth/agentOwnerSession";
import {
  parseAgentApprovalListQuery,
  validateAgentApprovalRejectInput,
} from "../../services/agent/AgentApprovalValidation";
import { AgentApprovalInboxHeader } from "../../components/agent/approvals/AgentApprovalInboxHeader";
import { AgentApprovalEmptyState } from "../../components/agent/approvals/AgentApprovalEmptyState";
import { AgentApprovalStatusBadge } from "../../components/agent/approvals/AgentApprovalStatusBadge";
import { AgentApprovalSourceBadge } from "../../components/agent/approvals/AgentApprovalSourceBadge";
import { AgentNotificationInboxHeader } from "../../components/agent/notifications/AgentNotificationInboxHeader";
import { AgentNotificationEmptyState } from "../../components/agent/notifications/AgentNotificationEmptyState";
import { AgentNotificationTypeBadge } from "../../components/agent/notifications/AgentNotificationTypeBadge";
import { AgentApprovalRepository } from "../../services/agent/AgentApprovalRepository";
import { AgentNotificationRepository } from "../../services/agent/AgentNotificationRepository";

const OWNER = {
  ownerId: "owner-1",
  walletAddress: "0x1111111111111111111111111111111111111111",
  username: "accessmesh",
  authenticationMethod: "CIRCLE_SESSION" as const,
};

test("approval validation rejects invalid rejection payloads and parses list queries", () => {
  assert.deepEqual(parseAgentApprovalListQuery({ limit: null, cursor: null, status: null }), {
    ok: true,
    query: {
      limit: 10,
      cursor: null,
      status: "all",
    },
  });

  assert.equal(validateAgentApprovalRejectInput({}).ok, true);
  assert.equal(validateAgentApprovalRejectInput({ reasonCode: "INVALID" }).ok, false);
  assert.equal(
    validateAgentApprovalRejectInput({ reasonText: "<script>alert(1)</script>" }).ok,
    false,
  );
});

test("approval and notification routes remain owner-scoped and private", async () => {
  const approvalPrototype = AgentApprovalRepository.prototype as unknown as {
    listApprovalsForOwner: typeof AgentApprovalRepository.prototype.listApprovalsForOwner;
    getPendingApprovalCount: typeof AgentApprovalRepository.prototype.getPendingApprovalCount;
    approveExecution: typeof AgentApprovalRepository.prototype.approveExecution;
    rejectExecution: typeof AgentApprovalRepository.prototype.rejectExecution;
  };
  const notificationPrototype = AgentNotificationRepository.prototype as unknown as {
    listNotificationsForOwner: typeof AgentNotificationRepository.prototype.listNotificationsForOwner;
    getUnreadCount: typeof AgentNotificationRepository.prototype.getUnreadCount;
  };

  const approvalsPage = {
    approvals: [
      buildApproval("approval-1", "execution-1", "APPROVED"),
      buildApproval("approval-2", "execution-2", "PENDING"),
    ],
    nextCursor: "cursor-token",
    hasMore: true,
  };

  const notificationsPage = {
    notifications: [buildNotification("notification-1", true)],
    nextCursor: "notification-cursor",
    hasMore: true,
  };

  const originalListApprovals = approvalPrototype.listApprovalsForOwner;
  const originalPendingCount = approvalPrototype.getPendingApprovalCount;
  const originalApproveExecution = approvalPrototype.approveExecution;
  const originalRejectExecution = approvalPrototype.rejectExecution;
  const originalListNotifications = notificationPrototype.listNotificationsForOwner;
  const originalUnreadCount = notificationPrototype.getUnreadCount;

  approvalPrototype.listApprovalsForOwner = async () => approvalsPage as never;
  approvalPrototype.getPendingApprovalCount = async () => 2;
  approvalPrototype.approveExecution = async () => ({
    approval: {
      ...buildApproval("approval-1", "execution-1", "APPROVED"),
      status: "APPROVED",
    },
  }) as never;
  approvalPrototype.rejectExecution = async () => ({
    approval: {
      ...buildApproval("approval-2", "execution-2", "REJECTED"),
      status: "REJECTED",
      reasonCode: "NO_LONGER_NEEDED",
      reasonText: "Not needed",
    },
  }) as never;
  notificationPrototype.listNotificationsForOwner = async () => notificationsPage as never;
  notificationPrototype.getUnreadCount = async () => 1;

  const cookie = encodeAgentOwnerSession(createAgentOwnerSessionPayload(OWNER));

  try {
    const approvalsResponse = await getApprovals(
      new Request("http://localhost/api/agent/approvals?status=pending", {
        headers: { cookie: `accessmesh_agent_owner_session=${cookie}` },
      }),
    );
    assert.equal(approvalsResponse.status, 200);
    assert.equal(approvalsResponse.headers.get("Cache-Control"), "private, no-store");

    const approvalsPayload = (await approvalsResponse.json()) as {
      ok: boolean;
      approvals: unknown[];
      pendingCount: number;
    };
    assert.equal(approvalsPayload.ok, true);
    assert.equal(approvalsPayload.pendingCount, 2);
    assert.equal(approvalsPayload.approvals.length, 2);

    const unreadResponse = await getUnreadCount(
      new Request("http://localhost/api/agent/notifications/unread-count", {
        headers: { cookie: `accessmesh_agent_owner_session=${cookie}` },
      }),
    );
    assert.equal(unreadResponse.status, 200);

    const notificationsResponse = await getNotifications(
      new Request("http://localhost/api/agent/notifications?filter=unread", {
        headers: { cookie: `accessmesh_agent_owner_session=${cookie}` },
      }),
    );
    assert.equal(notificationsResponse.status, 200);
    assert.equal(notificationsResponse.headers.get("Cache-Control"), "private, no-store");

    const notificationsPayload = (await notificationsResponse.json()) as {
      ok: boolean;
      notifications: unknown[];
      unreadCount: number;
    };
    assert.equal(notificationsPayload.ok, true);
    assert.equal(notificationsPayload.unreadCount, 1);

    const approveResponse = await approveApproval(
      new Request("http://localhost/api/agent/approvals/approval-1/approve", {
        method: "POST",
        headers: { cookie: `accessmesh_agent_owner_session=${cookie}` },
      }),
      { params: Promise.resolve({ id: "approval-1" }) },
    );
    assert.equal(approveResponse.status, 200);

    const rejectResponse = await rejectApproval(
      new Request("http://localhost/api/agent/approvals/approval-2/reject", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `accessmesh_agent_owner_session=${cookie}`,
        },
        body: JSON.stringify({
          reasonCode: "NO_LONGER_NEEDED",
          reasonText: "Not needed",
        }),
      }),
      { params: Promise.resolve({ id: "approval-2" }) },
    );
    assert.equal(rejectResponse.status, 200);
  } finally {
    approvalPrototype.listApprovalsForOwner = originalListApprovals;
    approvalPrototype.getPendingApprovalCount = originalPendingCount;
    approvalPrototype.approveExecution = originalApproveExecution;
    approvalPrototype.rejectExecution = originalRejectExecution;
    notificationPrototype.listNotificationsForOwner = originalListNotifications;
    notificationPrototype.getUnreadCount = originalUnreadCount;
  }
});

test("approval and notification headers and badges render safe copy", () => {
  const approvalHeader = renderToStaticMarkup(
    <AgentApprovalInboxHeader pendingCount={3} />,
  );
  assert.equal(approvalHeader.includes("Approval Inbox"), true);
  assert.equal(approvalHeader.includes("3 pending"), true);
  assert.equal(approvalHeader.includes("/agent"), true);

  const notificationHeader = renderToStaticMarkup(
    <AgentNotificationInboxHeader unreadCount={4} />,
  );
  assert.equal(notificationHeader.includes("Notifications"), true);
  assert.equal(notificationHeader.includes("4 unread"), true);

  const approvalEmpty = renderToStaticMarkup(<AgentApprovalEmptyState />);
  assert.equal(approvalEmpty.includes("No approval items yet"), true);

  const notificationEmpty = renderToStaticMarkup(<AgentNotificationEmptyState />);
  assert.equal(notificationEmpty.includes("No notifications yet"), true);

  const approvalStatus = renderToStaticMarkup(<AgentApprovalStatusBadge status="APPROVED" />);
  assert.equal(approvalStatus.includes("Approved"), true);

  const approvalSource = renderToStaticMarkup(<AgentApprovalSourceBadge source="SCHEDULED" />);
  assert.equal(approvalSource.includes("Scheduled"), true);

  const notificationType = renderToStaticMarkup(
    <AgentNotificationTypeBadge type="APPROVAL_REQUIRED" />,
  );
  assert.equal(notificationType.includes("Approval"), true);
});

function buildApproval(id: string, executionId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  return {
    id,
    executionId,
    source: "MANUAL" as const,
    goal: "Review this resource",
    policy: {
      id: "policy-1",
      name: "Balanced Buyer",
      version: 1,
    },
    resource: {
      id: "resource-1",
      title: "Persisted Resource",
      category: "AI",
    },
    recommendation: {
      score: 90,
      estimatedCostUSDC: "0.25",
      comparisonSummary: "Selected candidate.",
    },
    schedule: null,
    approvalStatus: status,
    status,
    decision: status === "PENDING" ? null : status,
    reasonCode: status === "REJECTED" ? "NO_LONGER_NEEDED" : null,
    reasonText: status === "REJECTED" ? "Not needed" : null,
    decidedAt: status === "PENDING" ? null : "2026-07-28T12:00:00.000Z",
    createdAt: "2026-07-28T11:55:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
    expiresAt: null,
  } as const;
}

function buildNotification(id: string, unread: boolean) {
  return {
    id,
    type: "APPROVAL_REQUIRED" as const,
    title: "Approval required",
    message: "A BUY recommendation is waiting for owner decision.",
    entityType: "execution",
    entityId: "execution-1",
    actionPath: "/agent/executions/execution-1",
    isUnread: unread,
    readAt: unread ? null : "2026-07-28T12:00:00.000Z",
    createdAt: "2026-07-28T11:55:00.000Z",
  } as const;
}
