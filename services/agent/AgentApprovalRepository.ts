import { InputError } from "@/lib/validation";
import { sanitizeJsonValue } from "./AgentExecutionSerialization";
import {
  ensureNotificationRecord,
  type AgentNotificationRepositoryClient,
} from "./AgentNotificationRepository";
import {
  encodeAgentApprovalCursor,
} from "./AgentApprovalValidation";
import type {
  AgentApprovalDetailView,
  AgentApprovalListFilter,
  AgentApprovalMutationResult,
  AgentApprovalRejectionReason,
} from "./AgentApprovalTypes";
import { toAgentApprovalSummary } from "./AgentApprovalViews";
import type {
  SerializableExecutionReasoning,
} from "./AgentExecutionTypes";

type PrismaLikeRecord = Record<string, unknown>;

const APPROVAL_SELECT = {
  id: true,
  executionId: true,
  ownerId: true,
  status: true,
  decision: true,
  reasonCode: true,
  reasonText: true,
  expiresAt: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<string, boolean>;

const EXECUTION_SELECT = {
  id: true,
  agentId: true,
  goal: true,
  status: true,
  decision: true,
  selectedResourceId: true,
  reasoning: true,
  estimatedCostUSDC: true,
  txHash: true,
  startedAt: true,
  completedAt: true,
} satisfies Record<string, boolean>;

export type AgentApprovalRepositoryClient = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { walletAddress: true };
    }): Promise<{ walletAddress: string } | null>;
  };
  agent: {
    findFirst(args: {
      where: { ownerWallet: string; name: string };
      select?: { id?: true; ownerWallet?: true; name?: true; status?: true; createdAt?: true };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<PrismaLikeRecord | null>;
  };
  agentExecution: {
    findUnique(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ startedAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
  };
  agentExecutionApproval: {
    findUnique(args: {
      where: { id?: string; executionId?: string; dedupeKey?: string };
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    findFirst(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    upsert(args: {
      where: { executionId: string };
      create: PrismaLikeRecord;
      update: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    updateMany(args: {
      where?: PrismaLikeRecord;
      data: PrismaLikeRecord;
    }): Promise<{ count: number }>;
    count(args: { where?: PrismaLikeRecord }): Promise<number>;
  };
  agentNotification: AgentNotificationRepositoryClient["agentNotification"];
  $transaction?<T>(fn: (tx: AgentApprovalRepositoryClient) => Promise<T>): Promise<T>;
};

type ApprovalResult = AgentApprovalMutationResult;

const DEFAULT_AGENT_NAME = "AccessMesh Research Agent";

export class AgentApprovalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentApprovalConflictError";
  }
}

export type ListApprovalsInput = Readonly<{
  ownerId: string;
  limit?: number;
  cursor?: { createdAt: string; id: string } | null;
  status?: AgentApprovalListFilter;
}>;

export type ApprovalDecisionInput = Readonly<{
  reasonCode?: AgentApprovalRejectionReason;
  reasonText?: string | null;
  expiresAt?: string | null;
}>;

export class AgentApprovalRepository {
  constructor(private readonly clientFactory?: () => Promise<AgentApprovalRepositoryClient>) {}

  async listPendingApprovalsForOwner(input: ListApprovalsInput): Promise<AgentApprovalDetailView[]> {
    const page = await this.listApprovalsForOwner({
      ...input,
      status: "pending",
    });

    return page.approvals;
  }

  async listApprovalsForOwner(input: ListApprovalsInput): Promise<{
    approvals: AgentApprovalDetailView[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const client = await this.getClient();
    const limit = normalizeLimit(input.limit);
    const status = input.status ?? "pending";
    const where: PrismaLikeRecord = {
      ownerId: input.ownerId,
    };

    if (status === "pending") {
      where.status = "PENDING";
    } else if (status === "resolved") {
      where.status = { in: ["APPROVED", "REJECTED", "EXPIRED", "NO_LONGER_ACTIONABLE"] };
    }

    if (input.cursor) {
      const cursorDate = new Date(input.cursor.createdAt);
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: input.cursor.id } },
      ];
    }

    const records = await client.agentExecutionApproval.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      select: APPROVAL_SELECT,
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const executionIds = pageRecords.map((approval) => String(approval.executionId));
    const executions =
      executionIds.length > 0
        ? await client.agentExecution.findMany({
            where: {
              id: { in: executionIds },
            },
            select: EXECUTION_SELECT,
          })
        : [];
    const executionById = new Map(executions.map((execution) => [String(execution.id), execution]));
    const approvals: AgentApprovalDetailView[] = [];

    for (const approval of pageRecords) {
      const execution = executionById.get(String(approval.executionId)) ?? null;
      if (!execution) {
        continue;
      }

      approvals.push(this.mapApproval(approval, execution));
    }

    const lastRecord = pageRecords[pageRecords.length - 1];
    return {
      approvals,
      nextCursor: hasMore && lastRecord ? encodeAgentApprovalCursor(encodeCursor(lastRecord)) : null,
      hasMore,
    };
  }

  async getApprovalForOwner(ownerId: string, approvalId: string) {
    const client = await this.getClient();
    const approval = await client.agentExecutionApproval.findUnique({
      where: { id: approvalId },
      select: APPROVAL_SELECT,
    });

    if (!approval || String(approval.ownerId) !== ownerId) {
      return null;
    }

    const execution = await client.agentExecution.findUnique({
      where: { id: String(approval.executionId) },
      select: EXECUTION_SELECT,
    });

    if (!execution) {
      return null;
    }

    return this.mapApproval(approval, execution);
  }

  async getApprovalForExecution(ownerId: string, executionId: string) {
    const client = await this.getClient();
    const approval = await client.agentExecutionApproval.findUnique({
      where: { executionId },
      select: APPROVAL_SELECT,
    });

    if (!approval || String(approval.ownerId) !== ownerId) {
      return null;
    }

    const execution = await client.agentExecution.findUnique({
      where: { id: executionId },
      select: EXECUTION_SELECT,
    });

    if (!execution) {
      return null;
    }

    return this.mapApproval(approval, execution);
  }

  async ensureApprovalForExecution(
    executionId: string,
    input: ApprovalDecisionInput & {
      ownerId: string;
    },
  ) {
    const client = await this.getClient();
    const owned = await this.requireOwnedExecution(client, input.ownerId, executionId);

    if (owned.execution.decision !== "BUY") {
      throw new AgentApprovalConflictError("execution is not eligible for approval");
    }

    if (
      owned.execution.status !== "RECOMMENDED_BUY" &&
      owned.execution.status !== "AWAITING_APPROVAL"
    ) {
      throw new AgentApprovalConflictError("execution is no longer awaiting approval");
    }

    const currentApproval = await client.agentExecutionApproval.findUnique({
      where: { executionId },
      select: APPROVAL_SELECT,
    });

    if (currentApproval) {
      if (String(currentApproval.ownerId) !== input.ownerId) {
        return null;
      }

      if (currentApproval.status === "PENDING" && !currentApproval.expiresAt && input.expiresAt) {
        const updated = await client.agentExecutionApproval.update({
          where: { id: String(currentApproval.id) },
          data: {
            expiresAt: new Date(input.expiresAt),
          },
          select: APPROVAL_SELECT,
        });

        return this.mapApproval(updated, owned.execution);
      }

      return this.mapApproval(currentApproval, owned.execution);
    }

    const approval = await client.agentExecutionApproval.create({
      data: {
        executionId,
        ownerId: input.ownerId,
        status: "PENDING",
        decision: null,
        reasonCode: null,
        reasonText: null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: APPROVAL_SELECT,
    });

    await ensureNotificationRecord(client, {
      ownerId: input.ownerId,
      type: "APPROVAL_REQUIRED",
      title: "Approval required",
      message: buildApprovalNotificationMessage(owned.execution),
      entityType: "execution",
      entityId: executionId,
      actionPath: `/agent/executions/${executionId}`,
      dedupeKey: `approval-required:${executionId}`,
    });

    return this.mapApproval(approval, owned.execution);
  }

  async approveExecution(approvalId: string, ownerId: string): Promise<ApprovalResult | null> {
    const client = await this.getClient();
    const approval = await client.agentExecutionApproval.findUnique({
      where: { id: approvalId },
      select: APPROVAL_SELECT,
    });

    if (!approval || String(approval.ownerId) !== ownerId) {
      return null;
    }

    if (isApprovalExpired(approval)) {
      const expired = await client.agentExecutionApproval.update({
        where: { id: approvalId },
        data: {
          status: "EXPIRED",
          decision: null,
          decidedAt: new Date(),
        },
        select: APPROVAL_SELECT,
      });
      await this.requireExecution(client, String(expired.executionId));
      throw new AgentApprovalConflictError("approval has expired");
    }

    if (approval.status === "APPROVED") {
      const execution = await this.requireExecution(client, String(approval.executionId));
      return { approval: this.mapApproval(approval, execution) };
    }

    if (approval.status === "REJECTED") {
      throw new AgentApprovalConflictError("approval was already rejected");
    }

    if (approval.status !== "PENDING") {
      throw new AgentApprovalConflictError("approval is no longer actionable");
    }

    const updated = await client.agentExecutionApproval.update({
      where: { id: approvalId },
      data: {
        status: "APPROVED",
        decision: "APPROVED",
        reasonCode: null,
        reasonText: null,
        decidedAt: new Date(),
      },
      select: APPROVAL_SELECT,
    });

    const execution = await this.requireExecution(client, String(updated.executionId));
    return { approval: this.mapApproval(updated, execution) };
  }

  async rejectExecution(
    approvalId: string,
    ownerId: string,
    input: ApprovalDecisionInput = {},
  ): Promise<ApprovalResult | null> {
    const client = await this.getClient();
    const approval = await client.agentExecutionApproval.findUnique({
      where: { id: approvalId },
      select: APPROVAL_SELECT,
    });

    if (!approval || String(approval.ownerId) !== ownerId) {
      return null;
    }

    if (isApprovalExpired(approval)) {
      const expired = await client.agentExecutionApproval.update({
        where: { id: approvalId },
        data: {
          status: "EXPIRED",
          decision: null,
          decidedAt: new Date(),
        },
        select: APPROVAL_SELECT,
      });
      await this.requireExecution(client, String(expired.executionId));
      throw new AgentApprovalConflictError("approval has expired");
    }

    if (approval.status === "REJECTED") {
      const execution = await this.requireExecution(client, String(approval.executionId));
      return { approval: this.mapApproval(approval, execution) };
    }

    if (approval.status === "APPROVED") {
      throw new AgentApprovalConflictError("approval was already approved");
    }

    if (approval.status !== "PENDING") {
      throw new AgentApprovalConflictError("approval is no longer actionable");
    }

    const updated = await client.agentExecutionApproval.update({
      where: { id: approvalId },
      data: {
        status: "REJECTED",
        decision: "REJECTED",
        reasonCode: input.reasonCode ?? "NO_LONGER_NEEDED",
        reasonText: input.reasonText ?? null,
        decidedAt: new Date(),
      },
      select: APPROVAL_SELECT,
    });

    const execution = await this.requireExecution(client, String(updated.executionId));
    return { approval: this.mapApproval(updated, execution) };
  }

  async getPendingApprovalCount(ownerId: string) {
    const client = await this.getClient();
    await this.expireNonActionableApprovals(ownerId);
    return client.agentExecutionApproval.count({
      where: {
        ownerId,
        status: "PENDING",
      },
    });
  }

  async expireNonActionableApprovals(ownerId?: string) {
    const client = await this.getClient();
    const result = await client.agentExecutionApproval.updateMany({
      where: {
        ...(ownerId ? { ownerId } : {}),
        status: "PENDING",
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
        decision: null,
        decidedAt: new Date(),
      },
    });

    return result.count;
  }

  async markExecutionNoLongerActionable(executionId: string, ownerId: string) {
    const client = await this.getClient();
    const approval = await client.agentExecutionApproval.findUnique({
      where: { executionId },
      select: APPROVAL_SELECT,
    });

    if (!approval || String(approval.ownerId) !== ownerId) {
      return null;
    }

    if (approval.status === "NO_LONGER_ACTIONABLE") {
      const execution = await this.requireExecution(client, executionId);
      return { approval: this.mapApproval(approval, execution) };
    }

    const updated = await client.agentExecutionApproval.update({
      where: { id: String(approval.id) },
      data: {
        status: "NO_LONGER_ACTIONABLE",
        decidedAt: new Date(),
      },
      select: APPROVAL_SELECT,
    });

    const execution = await this.requireExecution(client, executionId);
    return { approval: this.mapApproval(updated, execution) };
  }

  private async requireOwnedExecution(
    client: AgentApprovalRepositoryClient,
    ownerId: string,
    executionId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: ownerId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new InputError("owner not found");
    }

    const execution = await client.agentExecution.findUnique({
      where: { id: executionId },
      select: EXECUTION_SELECT,
    });

    if (!execution) {
      throw new InputError("execution not found");
    }

    const agent = await client.agent.findFirst({
      where: {
        ownerWallet: user.walletAddress,
        name: DEFAULT_AGENT_NAME,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ownerWallet: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    if (!agent || String(agent.id) !== String(execution.agentId)) {
      throw new InputError("execution not found");
    }

    return { execution };
  }

  private async requireExecution(client: AgentApprovalRepositoryClient, executionId: string) {
    const execution = await client.agentExecution.findUnique({
      where: { id: executionId },
      select: EXECUTION_SELECT,
    });

    if (!execution) {
      throw new InputError("execution not found");
    }

    return execution;
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentApprovalRepositoryClient;
  }

  private mapApproval(approval: PrismaLikeRecord, execution: PrismaLikeRecord): AgentApprovalDetailView {
    const summary = toAgentApprovalSummary(
      {
        id: String(approval.id),
        executionId: String(approval.executionId),
        ownerId: String(approval.ownerId),
        status: String(approval.status),
        decision: approval.decision as string | null,
        reasonCode: approval.reasonCode as string | null,
        reasonText: approval.reasonText as string | null,
        expiresAt: approval.expiresAt as Date | string | null,
        decidedAt: approval.decidedAt as Date | string | null,
        createdAt: approval.createdAt as Date | string,
        updatedAt: approval.updatedAt as Date | string,
      },
      {
        goal: String(execution.goal ?? ""),
        reasoning: normalizeReasoning(execution.reasoning),
        estimatedCostUSDC: normalizeOptionalNumber(execution.estimatedCostUSDC),
        startedAt: toIsoString(execution.startedAt),
      },
    );

    return {
      ...summary,
      status: summary.approvalStatus,
    };
  }

}

function normalizeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function isApprovalExpired(approval: PrismaLikeRecord) {
  if (!approval.expiresAt) {
    return false;
  }

  const expiresAt = approval.expiresAt instanceof Date
    ? approval.expiresAt
    : new Date(String(approval.expiresAt));

  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
}

function normalizeReasoning(value: unknown): SerializableExecutionReasoning | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = sanitizeJsonValue(value) as Record<string, unknown>;
  if (record.version !== 1) {
    return null;
  }

  return record as SerializableExecutionReasoning;
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  }

  return new Date().toISOString();
}

function encodeCursor(record: PrismaLikeRecord) {
  return {
    createdAt: toIsoString(record.createdAt),
    id: String(record.id),
  };
}

function buildApprovalNotificationMessage(
  execution: PrismaLikeRecord,
) {
  const reasoning = normalizeReasoning(execution.reasoning);
  const resourceTitle = reasoning?.selectedResource?.title ?? "a resource";
  const price = normalizeOptionalNumber(execution.estimatedCostUSDC);
  const priceText = price === null ? "an estimated price" : `${price.toFixed(2)} USDC`;

  return `A BUY recommendation for "${resourceTitle}" is waiting for your decision at ${priceText}.`;
}
