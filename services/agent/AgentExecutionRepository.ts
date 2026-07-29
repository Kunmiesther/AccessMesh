import { InputError } from "@/lib/validation";
import {
  buildExecutionReasoning,
  sanitizeJsonValue,
  serializeCandidateComparisonSummary,
  serializeCandidateEvaluationSnapshot,
  serializeFailureMetadata,
  serializeGoalSnapshot,
  serializePaymentMetadata,
  serializePolicySnapshot,
  serializeResourceSnapshot,
  serializeSettlementMetadata,
  serializeTraceEntries,
  serializeUnlockMetadata,
} from "./AgentExecutionSerialization";
import {
  isTerminalAgentExecutionStatus,
  validateAgentExecutionTransition,
} from "./AgentExecutionTransitions";
import type {
  AgentExecutionRecord,
  AgentExecutionStatus,
  AgentRecommendationDecision,
  AgentExecutionSummary,
  AgentExecutionHistoryPage,
  SerializableCandidateComparisonSummary,
  SerializableCandidateEvaluationSnapshot,
  SerializableExecutionReasoning,
  SerializableFailureMetadata,
  SerializableGoalSnapshot,
  SerializablePaymentMetadata,
  SerializablePolicySnapshot,
  SerializableResourceSnapshot,
  SerializableSettlementMetadata,
  SerializableTraceEntry,
  SerializableUnlockMetadata,
} from "./AgentExecutionTypes";
import { buildAgentExecutionSummary } from "./AgentExecutionViews";
import {
  expandAgentExecutionHistoryStatusFilter,
  type AgentExecutionHistoryCursor,
  type AgentExecutionHistoryDecisionFilter,
  type AgentExecutionHistoryStatusFilter,
} from "./AgentExecutionHistory";

const DEFAULT_AGENT_NAME = "AccessMesh Research Agent";

type PrismaLikeRecord = Record<string, unknown>;

export type AgentExecutionRepositoryClient = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { walletAddress: true };
    }): Promise<{ walletAddress: string } | null>;
  };
  agent: {
    findMany(args: {
      where: { ownerWallet: string };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
    findFirst(args: {
      where: { ownerWallet: string; name: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<PrismaLikeRecord | null>;
    create(args: {
      data: {
        ownerWallet: string;
        name: string;
        status: string;
      };
    }): Promise<PrismaLikeRecord>;
  };
  agentExecution: {
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    findUnique(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ startedAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
  };
  agentExecutionApproval?: {
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
  };
  $transaction?<T>(fn: (tx: AgentExecutionRepositoryClient) => Promise<T>): Promise<T>;
};

export type CreateExecutionInput = {
  ownerId: string;
  goal: SerializableGoalSnapshot;
  policySnapshot: SerializablePolicySnapshot;
  normalizedGoal: string;
  candidateCount?: number;
  trace?: readonly SerializableTraceEntry[];
};

export type RecommendationInput = {
  decision: AgentRecommendationDecision;
  candidateCount: number;
  comparisonSummary: SerializableCandidateComparisonSummary;
  candidateSummaries: readonly SerializableCandidateEvaluationSnapshot[];
  selectedResource: SerializableResourceSnapshot | null;
  selectedEvaluation: SerializableCandidateEvaluationSnapshot | null;
  trace: readonly SerializableTraceEntry[];
  estimatedCostUSDC?: number | null;
};

export type PaymentSubmissionInput = SerializablePaymentMetadata;

export type SettlementVerificationInput = SerializableSettlementMetadata;

export type UnlockInput = SerializableUnlockMetadata;

export type FailureInput = SerializableFailureMetadata;

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

const EXECUTION_LIST_SELECT = {
  id: true,
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

const APPROVAL_LIST_SELECT = {
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

export class AgentExecutionRepository {
  constructor(private readonly clientFactory?: () => Promise<AgentExecutionRepositoryClient>) {}

  async createExecution(input: CreateExecutionInput): Promise<AgentExecutionRecord> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.getOrCreateDefaultAgent(tx, input.ownerId);
      const reasoning = buildExecutionReasoning({
        version: 1,
        goal: serializeGoalSnapshot(input.goal),
        policy: serializePolicySnapshot(input.policySnapshot),
        normalizedGoal: input.normalizedGoal,
        candidateCount: input.candidateCount ?? 0,
        candidateSummaries: [],
        selectedResource: null,
        selectedEvaluation: null,
        comparisonSummary: serializeCandidateComparisonSummary({
          candidateCount: input.candidateCount ?? 0,
          budgetEligibleCount: 0,
          selectedCandidateId: null,
          topMatchScore: null,
          summary: "Execution created.",
        }),
        trace: serializeTraceEntries(input.trace ?? []),
        recommendation: {
          decision: "SKIP",
          status: "CREATED",
        },
        purchase: {
          status: "NOT_STARTED",
          settlementStatus: "NOT_STARTED",
          unlockStatus: "NOT_STARTED",
          transactionId: null,
          amountUSDC: null,
          resourceId: null,
        },
        failure: null,
      });

      const execution = await tx.agentExecution.create({
        data: {
          agentId: agent.id,
          goal: input.goal.originalGoal,
          status: "CREATED",
          decision: null,
          selectedResourceId: null,
          reasoning,
          estimatedCostUSDC: null,
          txHash: null,
        },
        select: EXECUTION_SELECT,
      });

      return this.mapExecution(execution);
    });
  }

  async markExecutionRunning(executionId: string) {
    return this.updateExecution(executionId, "RUNNING", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        recommendation: {
          ...reasoning.recommendation,
          status: "RUNNING",
        },
      }),
    });
  }

  async recordRecommendation(
    executionId: string,
    input: RecommendationInput,
  ): Promise<AgentExecutionRecord> {
    const execution = await this.getExecutionById(executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    if (
      execution.selectedResourceId &&
      input.selectedResource &&
      execution.selectedResourceId !== input.selectedResource.id
    ) {
      throw new InputError("selected resource cannot be replaced after recommendation");
    }

    const nextStatus: AgentExecutionStatus =
      input.decision === "BUY" ? "RECOMMENDED_BUY" : "RECOMMENDED_SKIP";

    return this.updateExecution(executionId, nextStatus, {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        candidateCount: input.candidateCount,
        candidateSummaries: serializeTraceableCandidates(input.candidateSummaries),
        selectedResource: input.selectedResource ? serializeResourceSnapshot(input.selectedResource) : null,
        selectedEvaluation: input.selectedEvaluation ? serializeCandidateEvaluationSnapshot(input.selectedEvaluation) : null,
        comparisonSummary: serializeCandidateComparisonSummary(input.comparisonSummary),
        trace: serializeTraceEntries(input.trace),
        recommendation: {
          decision: input.decision,
          status: nextStatus,
        },
        purchase: {
          ...reasoning.purchase,
          status: "NOT_STARTED",
        },
      }),
      updateData: {
        decision: input.decision,
        selectedResourceId: input.selectedResource?.id ?? null,
        estimatedCostUSDC:
          input.decision === "BUY"
            ? normalizeNumber(input.estimatedCostUSDC ?? input.selectedResource?.priceUSDC ?? null)
            : null,
      },
      terminalAtEnd: input.decision === "SKIP",
    });
  }

  async markAwaitingApproval(executionId: string) {
    return this.updateExecution(executionId, "AWAITING_APPROVAL", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        purchase: {
          ...reasoning.purchase,
          status: "AWAITING_APPROVAL",
        },
      }),
    });
  }

  async cancelAwaitingApproval(executionId: string) {
    return this.updateExecution(executionId, "RECOMMENDED_BUY", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        purchase: {
          ...reasoning.purchase,
          status: "NOT_STARTED",
          settlementStatus: "NOT_STARTED",
          unlockStatus: "NOT_STARTED",
        },
      }),
    });
  }

  async recordPaymentSubmitted(
    executionId: string,
    input: PaymentSubmissionInput,
  ) {
    const execution = await this.getExecutionById(executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    validateAgentExecutionTransition({
      from: execution.status as AgentExecutionStatus,
      to: "PAYMENT_SUBMITTED",
      idempotent: execution.status === "PAYMENT_SUBMITTED",
    });

    const currentReasoning = assertReasoning(execution.reasoning);
    const existingTransactionId = execution.txHash;
    if (existingTransactionId && existingTransactionId !== input.transactionId) {
      throw new InputError("payment transaction identifier cannot be changed");
    }

    if (
      execution.selectedResourceId &&
      execution.selectedResourceId !== input.resourceId
    ) {
      throw new InputError("selected resource cannot be replaced after recommendation");
    }

    const nextReasoning = buildExecutionReasoning({
      ...currentReasoning,
      purchase: {
        ...currentReasoning.purchase,
        status: "SUBMITTED",
        transactionId: input.transactionId,
        amountUSDC: input.amountUSDC,
        resourceId: input.resourceId,
      },
    });

    const updated = await this.getClient().then((client) =>
      client.agentExecution.update({
        where: { id: executionId },
        data: {
          status: "PAYMENT_SUBMITTED",
          txHash: input.transactionId,
          estimatedCostUSDC: normalizeNumber(input.amountUSDC),
          selectedResourceId: input.resourceId,
          reasoning: nextReasoning,
        },
        select: EXECUTION_SELECT,
      }),
    );

    return this.mapExecution(updated);
  }

  async markSettlementVerification(
    executionId: string,
    input?: SettlementVerificationInput,
  ) {
    return this.updateExecution(executionId, "VERIFYING_SETTLEMENT", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        purchase: {
          ...reasoning.purchase,
          status: "SUBMITTED",
          settlementStatus: input?.status ?? "VERIFYING",
          transactionId: input?.transactionId ?? reasoning.purchase.transactionId,
        },
      }),
    });
  }

  async markUnlocking(executionId: string, input?: UnlockInput) {
    return this.updateExecution(executionId, "UNLOCKING", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        purchase: {
          ...reasoning.purchase,
          status: "SUBMITTED",
          settlementStatus: reasoning.purchase.settlementStatus === "FAILED" ? "FAILED" : "VERIFYING",
          unlockStatus: input?.status ?? "UNLOCKING",
          transactionId: input?.transactionId ?? reasoning.purchase.transactionId,
        },
      }),
    });
  }

  async completeExecution(
    executionId: string,
    input?: Partial<PaymentSubmissionInput & UnlockInput & SettlementVerificationInput>,
  ) {
    const execution = await this.getExecutionById(executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    if (execution.status === "COMPLETED") {
      const currentReasoning = assertReasoning(execution.reasoning);
      const currentPurchase = currentReasoning.purchase;
      const nextTransactionId = input?.transactionId ?? currentPurchase.transactionId;
      const nextAmount = normalizeOptionalNumber(
        input?.amountUSDC ?? currentPurchase.amountUSDC,
      );
      const nextResourceId = input?.resourceId ?? currentPurchase.resourceId;

      if (
        currentPurchase.status === "COMPLETED" &&
        currentPurchase.settlementStatus === "SETTLED" &&
        currentPurchase.unlockStatus === "UNLOCKED" &&
        currentPurchase.transactionId === nextTransactionId &&
        currentPurchase.amountUSDC === nextAmount &&
        currentPurchase.resourceId === nextResourceId
      ) {
        return execution;
      }
    }

    return this.updateExecution(executionId, "COMPLETED", {
      idempotent: true,
      updateReasoning: (reasoning) => ({
        ...reasoning,
        purchase: {
          ...reasoning.purchase,
          status: "COMPLETED",
          settlementStatus: "SETTLED",
          unlockStatus: "UNLOCKED",
          transactionId: input?.transactionId ?? reasoning.purchase.transactionId,
          amountUSDC: normalizeOptionalNumber(input?.amountUSDC ?? reasoning.purchase.amountUSDC),
          resourceId: input?.resourceId ?? reasoning.purchase.resourceId,
        },
      }),
      updateData: {
        completedAt: new Date(),
      },
    });
  }

  async failExecution(executionId: string, failure: FailureInput) {
    const execution = await this.getExecutionById(executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    validateAgentExecutionTransition({
      from: execution.status as AgentExecutionStatus,
      to: "FAILED",
      idempotent: execution.status === "FAILED",
    });

    const currentReasoning = assertReasoning(execution.reasoning);
    const normalizedFailure = serializeFailureMetadata(failure);

    if (execution.status === "FAILED") {
      const currentFailure = currentReasoning.failure;
      if (
        currentFailure &&
        currentFailure.code === normalizedFailure.code &&
        currentFailure.message === normalizedFailure.message &&
        currentFailure.stage === normalizedFailure.stage
      ) {
        return execution;
      }
    }

    const updated = await this.getClient().then((client) =>
      client.agentExecution.update({
        where: { id: executionId },
        data: {
          status: "FAILED",
          reasoning: buildExecutionReasoning({
            ...currentReasoning,
            purchase: {
              ...currentReasoning.purchase,
              status: "FAILED",
              settlementStatus: currentReasoning.purchase.settlementStatus === "SETTLED" ? "SETTLED" : "FAILED",
              unlockStatus: "FAILED",
            },
            failure: normalizedFailure,
          }),
          completedAt: new Date(),
        },
        select: EXECUTION_SELECT,
      }),
    );

    return this.mapExecution(updated);
  }

  async getExecutionById(executionId: string): Promise<AgentExecutionRecord | null> {
    const client = await this.getClient();
    const execution = await client.agentExecution.findUnique({
      where: { id: executionId },
      select: EXECUTION_SELECT,
    });

    return execution ? this.mapExecution(execution) : null;
  }

  async listExecutionsForOwner(input: {
    ownerId: string;
    limit?: number;
    cursor?: AgentExecutionHistoryCursor | null;
    status?: AgentExecutionHistoryStatusFilter;
    decision?: AgentExecutionHistoryDecisionFilter;
    sort?: "newest" | "oldest";
  }): Promise<AgentExecutionHistoryPage> {
    const client = await this.getClient();
    const user = await client.user.findUnique({
      where: { id: input.ownerId },
      select: { walletAddress: true },
    });

    if (!user) {
      return {
        executions: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const agents = await client.agent.findMany({
      where: { ownerWallet: user.walletAddress },
      select: { id: true },
    });

    if (agents.length === 0) {
      return {
        executions: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const agentIds = agents.map((agent) => agent.id);
    const limit = normalizeHistoryLimit(input.limit);
    const order = input.sort === "oldest" ? "asc" : "desc";
    const statuses =
      input.status && input.status !== "all"
        ? expandAgentExecutionHistoryStatusFilter(input.status)
        : null;
    const decisions = input.decision && input.decision !== "all" ? input.decision : null;

    const where = buildHistoryWhere({
      agentIds,
      cursor: input.cursor ?? null,
      statuses,
      decisions,
      order,
    });

    const records = await client.agentExecution.findMany({
      where,
      orderBy: [
        { startedAt: order },
        { id: order },
      ],
      take: limit + 1,
      select: EXECUTION_LIST_SELECT,
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const approvals =
      pageRecords.length > 0 && client.agentExecutionApproval
        ? await client.agentExecutionApproval.findMany({
            where: {
              executionId: {
                in: pageRecords.map((record) => String(record.id)),
              },
            },
            select: APPROVAL_LIST_SELECT,
          })
        : [];
    const approvalByExecutionId = new Map(
      approvals.map((approval) => [String(approval.executionId), approval]),
    );
    const executions = pageRecords.map((record) =>
      this.mapExecutionSummary(record, approvalByExecutionId.get(String(record.id)) ?? null),
    );
    const lastRecord = pageRecords[pageRecords.length - 1];

    return {
      executions,
      nextCursor: hasMore && lastRecord ? encodeHistoryCursor(lastRecord) : null,
      hasMore,
    };
  }

  private async updateExecution(
    executionId: string,
    nextStatus: AgentExecutionStatus,
    options: {
      idempotent?: boolean;
      updateReasoning: (reasoning: SerializableExecutionReasoning) => SerializableExecutionReasoning;
      updateData?: PrismaLikeRecord;
      terminalAtEnd?: boolean;
    },
  ): Promise<AgentExecutionRecord> {
    const execution = await this.getExecutionById(executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    validateAgentExecutionTransition({
      from: execution.status as AgentExecutionStatus,
      to: nextStatus,
      idempotent: options.idempotent,
    });

    const currentReasoning = assertReasoning(execution.reasoning);
    const nextReasoning = buildExecutionReasoning(options.updateReasoning(currentReasoning));
    if (
      execution.status === nextStatus &&
      options.idempotent &&
      deepEqual(currentReasoning, nextReasoning) &&
      !options.updateData
    ) {
      return execution;
    }

    const updated = await this.getClient().then((client) =>
      client.agentExecution.update({
        where: { id: executionId },
        data: {
          status: nextStatus,
          reasoning: nextReasoning,
          ...(options.updateData ?? {}),
          ...(options.terminalAtEnd ? { completedAt: new Date() } : {}),
        },
        select: EXECUTION_SELECT,
      }),
    );

    return this.mapExecution(updated);
  }

  private async getOrCreateDefaultAgent(
    client: AgentExecutionRepositoryClient,
    ownerId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: ownerId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new InputError("owner not found");
    }

    const existing = await client.agent.findFirst({
      where: {
        ownerWallet: user.walletAddress,
        name: DEFAULT_AGENT_NAME,
      },
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      return existing;
    }

    return client.agent.create({
      data: {
        ownerWallet: user.walletAddress,
        name: DEFAULT_AGENT_NAME,
        status: "ACTIVE",
      },
    });
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentExecutionRepositoryClient;
  }

  private async withTransaction<T>(
    client: AgentExecutionRepositoryClient,
    callback: (tx: AgentExecutionRepositoryClient) => Promise<T>,
  ) {
    if (client.$transaction) {
      return client.$transaction((tx) => callback(tx));
    }

    return callback(client);
  }

  private mapExecution(execution: PrismaLikeRecord): AgentExecutionRecord {
    const startedAt = toIsoString(execution.startedAt);
    const completedAt = toOptionalIsoString(execution.completedAt);

    return {
      id: String(execution.id),
      agentId: String(execution.agentId),
      goal: String(execution.goal ?? ""),
      status: String(execution.status ?? "CREATED"),
      decision: isRecommendationDecision(execution.decision) ? execution.decision : null,
      selectedResourceId:
        typeof execution.selectedResourceId === "string" && execution.selectedResourceId.trim().length > 0
          ? execution.selectedResourceId
          : null,
      reasoning: normalizeReasoning(execution.reasoning),
      estimatedCostUSDC: normalizeOptionalNumber(execution.estimatedCostUSDC),
      txHash:
        typeof execution.txHash === "string" && execution.txHash.trim().length > 0
          ? execution.txHash
          : null,
      startedAt,
      completedAt,
    };
  }

  private mapExecutionSummary(
    execution: PrismaLikeRecord,
    approval: PrismaLikeRecord | null = null,
  ): AgentExecutionSummary {
    return buildAgentExecutionSummary(this.mapExecution(execution), approval as never);
  }
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

function assertReasoning(
  reasoning: SerializableExecutionReasoning | null,
): SerializableExecutionReasoning {
  if (!reasoning) {
    throw new InputError("execution reasoning is missing");
  }

  return reasoning;
}

function normalizeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
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

function toOptionalIsoString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return toIsoString(value);
}

function isRecommendationDecision(value: unknown): value is AgentRecommendationDecision {
  return value === "BUY" || value === "SKIP";
}

function deepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function serializeTraceableCandidates(
  candidates: readonly SerializableCandidateEvaluationSnapshot[],
) {
  return candidates.map((candidate) => serializeCandidateEvaluationSnapshot(candidate));
}

function normalizeHistoryLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function buildHistoryWhere(params: {
  agentIds: string[];
  cursor: AgentExecutionHistoryCursor | null;
  statuses: readonly AgentExecutionStatus[] | null;
  decisions: AgentExecutionHistoryDecisionFilter | null;
  order: "asc" | "desc";
}) {
  const where: Record<string, unknown> = {
    agentId: { in: params.agentIds },
  };

  if (params.statuses && params.statuses.length > 0) {
    where.status = { in: params.statuses };
  }

  if (params.decisions && params.decisions !== "all") {
    where.decision = params.decisions;
  }

  if (params.cursor) {
    const cursorDate = new Date(params.cursor.startedAt);
    where.OR =
      params.order === "desc"
        ? [
            { startedAt: { lt: cursorDate } },
            { startedAt: cursorDate, id: { lt: params.cursor.id } },
          ]
        : [
            { startedAt: { gt: cursorDate } },
            { startedAt: cursorDate, id: { gt: params.cursor.id } },
          ];
  }

  return where;
}

function encodeHistoryCursor(execution: PrismaLikeRecord) {
  return base64UrlEncode(
    JSON.stringify({
      startedAt: toIsoString(execution.startedAt),
      id: String(execution.id),
    }),
  );
}

function base64UrlEncode(input: string | Uint8Array) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
