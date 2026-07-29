import { InputError } from "@/lib/validation";
import { sanitizeJsonValue } from "./AgentExecutionSerialization";
import { AgentPolicyConflictError } from "./AgentPolicyRepository";
import {
  formatMicrosToUsdcString,
  normalizeUsdcToMicros,
  resolveBudgetPeriodBounds,
} from "./AgentBudgetValidation";
import type {
  AgentBudgetActivityPage,
  AgentBudgetBucketView,
  AgentBudgetCommitResult,
  AgentBudgetLedgerEntryView,
  AgentBudgetPeriodType,
  AgentBudgetReleaseReason,
  AgentBudgetReleaseResult,
  AgentBudgetReserveResult,
  AgentBudgetReservationView,
  AgentBudgetSummaryView,
} from "./AgentBudgetTypes";
import {
  toAgentBudgetBucketView,
  toAgentBudgetCommitResult,
  toAgentBudgetLedgerEntryView,
  toAgentBudgetReleaseResult,
  toAgentBudgetReserveResult,
  toAgentBudgetReservationView,
} from "./AgentBudgetViews";

type PrismaLikeRecord = Record<string, unknown>;

const DEFAULT_PERIOD_TYPE: AgentBudgetPeriodType = "DAILY";
const DEFAULT_RESERVATION_EXPIRATION_MS = 15 * 60 * 1000;
const MAX_ACTIVITY_LIMIT = 50;

type BudgetPolicyRow = Readonly<{
  id: string;
  agentId: string;
  name: string;
  status: string;
  version: number;
  dailyBudgetUSDC: number;
  remainingBudgetUSDC: number;
  maxPurchaseUSDC: number;
  minimumScore: number;
  manualApprovalRequired: boolean;
  expiresAt: Date | string | null;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  agent: {
    id: string;
    ownerWallet: string;
  };
}>;

type ResolvedBudgetPolicyRow = BudgetPolicyRow & {
  dailyBudgetMicros: bigint;
};

type BudgetBucketRow = Readonly<{
  id: string;
  ownerId: string;
  policyId: string;
  periodType: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  limitMicros: bigint | number | string;
  committedMicros: bigint | number | string;
  reservedMicros: bigint | number | string;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  policy: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  reservations?: Array<{ id: string; status: string }>;
}>;

type BudgetReservationRow = Readonly<{
  id: string;
  bucketId: string;
  executionId: string;
  amountMicros: bigint | number | string;
  status: string;
  expiresAt: Date | string | null;
  committedAt: Date | string | null;
  releasedAt: Date | string | null;
  releaseReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  bucket: BudgetBucketRow;
}>;

type BudgetLedgerRow = Readonly<{
  id: string;
  bucketId: string;
  executionId: string | null;
  reservationId: string | null;
  type: string;
  amountMicros: bigint | number | string;
  dedupeKey: string;
  metadata: unknown;
  createdAt: Date | string;
  bucket: BudgetBucketRow;
}>;

type BudgetExecutionRow = Readonly<{
  id: string;
  agentId: string;
  goal: string;
  status: string;
  decision: string | null;
  selectedResourceId: string | null;
  reasoning: unknown;
  estimatedCostUSDC: number | null;
  txHash: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
  agent: {
    id: string;
    ownerWallet: string;
  };
}>;

const BUDGET_BUCKET_SELECT = {
  id: true,
  ownerId: true,
  policyId: true,
  periodType: true,
  periodStart: true,
  periodEnd: true,
  limitMicros: true,
  committedMicros: true,
  reservedMicros: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  policy: {
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
    },
  },
  reservations: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Record<string, unknown>;

const BUDGET_RESERVATION_SELECT = {
  id: true,
  bucketId: true,
  executionId: true,
  amountMicros: true,
  status: true,
  expiresAt: true,
  committedAt: true,
  releasedAt: true,
  releaseReason: true,
  createdAt: true,
  updatedAt: true,
  bucket: {
    select: {
      id: true,
      ownerId: true,
      policyId: true,
      periodType: true,
      periodStart: true,
      periodEnd: true,
      limitMicros: true,
      committedMicros: true,
      reservedMicros: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      policy: {
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
        },
      },
    },
  },
} satisfies Record<string, unknown>;

const BUDGET_ENTRY_SELECT = {
  id: true,
  bucketId: true,
  executionId: true,
  reservationId: true,
  type: true,
  amountMicros: true,
  dedupeKey: true,
  metadata: true,
  createdAt: true,
  bucket: {
    select: {
      id: true,
      ownerId: true,
      policyId: true,
      periodType: true,
      periodStart: true,
      periodEnd: true,
      limitMicros: true,
      committedMicros: true,
      reservedMicros: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      policy: {
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export type AgentBudgetRepositoryClient = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { walletAddress: true };
    }): Promise<{ walletAddress: string } | null>;
  };
  agent: {
    findFirst(args: {
      where: { ownerWallet: string; name: string };
      select?: { id?: true; ownerWallet?: true; name?: true; status?: true; defaultPolicyId?: true };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<PrismaLikeRecord | null>;
  };
  agentPolicy: {
    findUnique(args: {
      where: { id: string };
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord | null>;
  };
  agentExecution: {
    findUnique(args: {
      where: { id: string };
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord | null>;
  };
  agentBudgetBucket: {
    findUnique(args: {
      where: { policyId_periodType_periodStart: { policyId: string; periodType: string; periodStart: Date } };
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord | null>;
    findFirst(args: {
      where?: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord | null>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ periodStart: "asc" | "desc" } | { createdAt: "asc" | "desc" }>;
      take?: number;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord[]>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
    updateMany(args: {
      where?: PrismaLikeRecord;
      data: PrismaLikeRecord;
    }): Promise<{ count: number }>;
    upsert(args: {
      where: { policyId_periodType_periodStart: { policyId: string; periodType: string; periodStart: Date } };
      create: PrismaLikeRecord;
      update: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
  };
  agentBudgetReservation: {
    findUnique(args: {
      where: { id?: string; executionId?: string };
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord | null>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord[]>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
    updateMany(args: {
      where?: PrismaLikeRecord;
      data: PrismaLikeRecord;
    }): Promise<{ count: number }>;
  };
  agentBudgetLedgerEntry: {
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord[]>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, unknown>;
    }): Promise<PrismaLikeRecord>;
  };
  $transaction?<T>(fn: (tx: AgentBudgetRepositoryClient) => Promise<T>): Promise<T>;
};

export type ReserveBudgetInput = Readonly<{
  ownerId: string;
  policyId: string;
  executionId: string;
  amountUSDC: string | number | bigint;
  expiresAt?: Date | string | null;
}>;

export type CommitBudgetInput = Readonly<{
  ownerId: string;
  policyId: string;
  executionId: string;
  transactionId: string;
  amountUSDC: string | number | bigint;
  resourceId?: string | null;
}>;

export type ReleaseBudgetInput = Readonly<{
  ownerId: string;
  policyId: string;
  executionId: string;
  reason: AgentBudgetReleaseReason;
  amountUSDC?: string | number | bigint;
}>;

export type BudgetActivityCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

export type ListBudgetActivityInput = Readonly<{
  ownerId: string;
  cursor?: BudgetActivityCursor | null;
  limit?: number;
}>;

export class AgentBudgetConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBudgetConflictError";
  }
}

export class AgentBudgetRepository {
  constructor(private readonly clientFactory?: () => Promise<AgentBudgetRepositoryClient>) {}

  async getOrCreateCurrentBucket(
    ownerId: string,
    policyId: string,
    periodType: AgentBudgetPeriodType = DEFAULT_PERIOD_TYPE,
    now = new Date(),
  ): Promise<AgentBudgetBucketView> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const policy = await this.requireOwnedActivePolicy(tx, ownerId, policyId);
      const bounds = resolveBudgetPeriodBounds(periodType, now);
      const bucket = (await tx.agentBudgetBucket.upsert({
        where: {
          policyId_periodType_periodStart: {
            policyId,
            periodType,
            periodStart: new Date(bounds.periodStart),
          },
        },
        create: {
          ownerId,
          policyId,
          periodType,
          periodStart: new Date(bounds.periodStart),
          periodEnd: new Date(bounds.periodEnd),
          limitMicros: policy.dailyBudgetMicros,
          committedMicros: BigInt(0),
          reservedMicros: BigInt(0),
          version: 1,
        },
        update: {},
        select: BUDGET_BUCKET_SELECT as never,
      })) as BudgetBucketRow;

      return this.mapBucket(bucket);
    });
  }

  async getCurrentBudgetForPolicy(
    ownerId: string,
    policyId: string,
    periodType: AgentBudgetPeriodType = DEFAULT_PERIOD_TYPE,
  ): Promise<AgentBudgetBucketView> {
    await this.expireReservations(ownerId, policyId);
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const bucket = await this.findCurrentBucket(tx, ownerId, policyId, periodType);
      if (!bucket) {
        const policy = await this.requireOwnedPolicy(tx, ownerId, policyId);
        return this.buildVirtualBucket(policy, periodType);
      }

      return this.mapBucket(bucket);
    });
  }

  async reserveBudgetForExecution(input: ReserveBudgetInput): Promise<AgentBudgetReserveResult> {
    await this.expireReservations(input.ownerId, input.policyId);
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const policy = await this.requireOwnedActivePolicy(tx, input.ownerId, input.policyId);
      const execution = await this.requireOwnedExecution(tx, input.ownerId, input.executionId);
      const amountMicros = parsePositiveMicros(input.amountUSDC, "amountUSDC");
      this.assertExecutionMatchesPolicy(execution, input.policyId, amountMicros);

      const bucket = await this.getOrCreateBucketRow(tx, input.ownerId, policy, DEFAULT_PERIOD_TYPE);
      const refreshedBucket = await this.findBucketById(tx, bucket.id);
      if (!refreshedBucket) {
        throw new InputError("budget bucket not found");
      }

      const existingReservation = (await tx.agentBudgetReservation.findUnique({
        where: { executionId: input.executionId },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow | null;

      if (existingReservation) {
        if (toBigInt(existingReservation.amountMicros) !== amountMicros) {
          throw new AgentBudgetConflictError("reservation already exists for a different amount");
        }

        return toAgentBudgetReserveResult({
          bucket: refreshedBucket,
          reservation: existingReservation,
          activity: await this.findLatestActivityForReservation(tx, String(existingReservation.id)),
        });
      }

      const availableMicros =
        toBigInt(refreshedBucket.limitMicros) -
        toBigInt(refreshedBucket.committedMicros) -
        toBigInt(refreshedBucket.reservedMicros);
      if (amountMicros > availableMicros) {
        throw new AgentBudgetConflictError("insufficient policy budget");
      }

      const nextBucket = await this.updateBucketTotals(tx, refreshedBucket.id, {
        reservedDeltaMicros: amountMicros,
      });
      if (!nextBucket) {
        throw new AgentBudgetConflictError("budget reservation could not be created");
      }

      const reservation = (await tx.agentBudgetReservation.create({
        data: {
          bucketId: refreshedBucket.id,
          executionId: input.executionId,
          amountMicros,
          status: "ACTIVE",
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + DEFAULT_RESERVATION_EXPIRATION_MS),
          committedAt: null,
          releasedAt: null,
          releaseReason: null,
        },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow;

      const activity = (await tx.agentBudgetLedgerEntry.create({
        data: {
          bucketId: refreshedBucket.id,
          executionId: input.executionId,
          reservationId: reservation.id,
          type: "RESERVATION",
          amountMicros,
          dedupeKey: `reservation:${input.executionId}:${amountMicros.toString()}`,
          metadata: sanitizeJsonValue({
            policyId: policy.id,
            policyName: policy.name,
            periodType: DEFAULT_PERIOD_TYPE,
            reason: "payment-preparation",
          }),
        },
        select: BUDGET_ENTRY_SELECT as never,
      })) as BudgetLedgerRow;

      return toAgentBudgetReserveResult({
        bucket: nextBucket,
        reservation,
        activity,
      });
    });
  }

  async commitReservation(input: CommitBudgetInput): Promise<AgentBudgetCommitResult> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const policy = await this.requireOwnedPolicy(tx, input.ownerId, input.policyId);
      const execution = await this.requireOwnedExecution(tx, input.ownerId, input.executionId);
      const amountMicros = parsePositiveMicros(input.amountUSDC, "amountUSDC");
      this.assertExecutionMatchesPolicy(execution, input.policyId, amountMicros);

      const reservation = (await tx.agentBudgetReservation.findUnique({
        where: { executionId: input.executionId },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow | null;

      if (!reservation) {
        throw new AgentBudgetConflictError("reservation not found");
      }

      if (reservation.bucket.policyId !== input.policyId) {
        throw new AgentBudgetConflictError("reservation policy mismatch");
      }

      const current = this.mapReservation(reservation);
      if (current.status === "COMMITTED") {
        const latestActivity = await this.findLatestActivityForReservation(tx, current.id);
        return {
          bucket: this.mapBucket(reservation.bucket),
          reservation: current,
          activity: latestActivity ? this.mapActivity(latestActivity) : null,
        };
      }

      if (current.status === "RELEASED" || current.status === "EXPIRED") {
        throw new AgentBudgetConflictError("reservation is no longer actionable");
      }

      if (toBigInt(reservation.amountMicros) !== amountMicros) {
        throw new AgentBudgetConflictError("reservation amount mismatch");
      }

      if (reservation.expiresAt && new Date(reservation.expiresAt).getTime() < Date.now()) {
        throw new AgentBudgetConflictError("reservation has expired");
      }

      const updatedReservation = (await tx.agentBudgetReservation.update({
        where: { id: reservation.id },
        data: {
          status: "COMMITTED",
          committedAt: new Date(),
          releasedAt: null,
          releaseReason: null,
        },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow;

      const nextBucket = await this.updateBucketTotals(tx, reservation.bucketId, {
        reservedDeltaMicros: -amountMicros,
        committedDeltaMicros: amountMicros,
      });
      if (!nextBucket) {
        throw new AgentBudgetConflictError("budget commit could not be created");
      }

      const activity = (await tx.agentBudgetLedgerEntry.create({
        data: {
          bucketId: reservation.bucketId,
          executionId: input.executionId,
          reservationId: reservation.id,
          type: "COMMITMENT",
          amountMicros,
          dedupeKey: `commit:${input.executionId}:${input.transactionId}`,
          metadata: sanitizeJsonValue({
            policyId: policy.id,
            policyName: policy.name,
            transactionId: input.transactionId,
            resourceId: input.resourceId ?? null,
          }),
        },
        select: BUDGET_ENTRY_SELECT as never,
      })) as BudgetLedgerRow;

      return toAgentBudgetCommitResult({
        bucket: nextBucket,
        reservation: updatedReservation,
        activity,
      });
    });
  }

  async releaseReservation(input: ReleaseBudgetInput): Promise<AgentBudgetReleaseResult> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const policy = await this.requireOwnedPolicy(tx, input.ownerId, input.policyId);
      const execution = await this.requireOwnedExecution(tx, input.ownerId, input.executionId);
      const reservation = (await tx.agentBudgetReservation.findUnique({
        where: { executionId: input.executionId },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow | null;

      if (!reservation) {
        throw new AgentBudgetConflictError("reservation not found");
      }

      if (reservation.bucket.policyId !== input.policyId) {
        throw new AgentBudgetConflictError("reservation policy mismatch");
      }

      const current = this.mapReservation(reservation);
      if (current.status === "RELEASED" || current.status === "EXPIRED") {
        const latestActivity = await this.findLatestActivityForReservation(tx, current.id);
        return {
          bucket: this.mapBucket(reservation.bucket),
          reservation: current,
          activity: latestActivity ? this.mapActivity(latestActivity) : null,
        };
      }

      if (current.status === "COMMITTED") {
        throw new AgentBudgetConflictError("committed reservation cannot be released");
      }

      const amountMicros = parsePositiveMicros(input.amountUSDC ?? current.amountUSDC, "amountUSDC");
      if (amountMicros !== toBigInt(reservation.amountMicros)) {
        throw new AgentBudgetConflictError("reservation amount mismatch");
      }

      const updatedReservation = (await tx.agentBudgetReservation.update({
        where: { id: reservation.id },
        data: {
          status: input.reason === "RESERVATION_EXPIRED" ? "EXPIRED" : "RELEASED",
          releasedAt: new Date(),
          releaseReason: input.reason,
        },
        select: BUDGET_RESERVATION_SELECT as never,
      })) as BudgetReservationRow;

      const nextBucket = await this.updateBucketTotals(tx, reservation.bucketId, {
        reservedDeltaMicros: -amountMicros,
      });
      if (!nextBucket) {
        throw new AgentBudgetConflictError("budget release could not be created");
      }

      const activity = (await tx.agentBudgetLedgerEntry.create({
        data: {
          bucketId: reservation.bucketId,
          executionId: input.executionId,
          reservationId: reservation.id,
          type: "RELEASE",
          amountMicros: -amountMicros,
          dedupeKey: `release:${input.executionId}:${input.reason}`,
          metadata: sanitizeJsonValue({
            policyId: policy.id,
            policyName: policy.name,
            reason: input.reason,
            executionId: execution.id,
          }),
        },
        select: BUDGET_ENTRY_SELECT as never,
      })) as BudgetLedgerRow;

      return toAgentBudgetReleaseResult({
        bucket: nextBucket,
        reservation: updatedReservation,
        activity,
      });
    });
  }

  async expireReservations(ownerId?: string, policyId?: string) {
    const client = await this.getClient();
    const where: PrismaLikeRecord = {
      status: "ACTIVE",
      expiresAt: {
        not: null,
        lt: new Date(),
      },
    };

    if (policyId) {
      where.bucket = { ...(where.bucket ?? {}), policyId };
    }

    if (ownerId) {
      where.bucket = { ...(where.bucket ?? {}), ownerId };
    }

    const expired = (await client.agentBudgetReservation.findMany({
      where,
      select: BUDGET_RESERVATION_SELECT as never,
    })) as BudgetReservationRow[];

    let count = 0;
    for (const reservation of expired) {
      await this.releaseReservation({
        ownerId: reservation.bucket.ownerId,
        policyId: reservation.bucket.policyId,
        executionId: reservation.executionId,
        reason: "RESERVATION_EXPIRED",
        amountUSDC: reservation.amountMicros,
      }).catch(() => {});
      count += 1;
    }

    return count;
  }

  async getReservationForExecution(ownerId: string, executionId: string): Promise<AgentBudgetReservationView | null> {
    const client = await this.getClient();
    const reservation = (await client.agentBudgetReservation.findUnique({
      where: { executionId },
      select: BUDGET_RESERVATION_SELECT as never,
    })) as BudgetReservationRow | null;

    if (!reservation || reservation.bucket.ownerId !== ownerId) {
      return null;
    }

    return this.mapReservation(reservation);
  }

  async listBudgetActivityForOwner(input: ListBudgetActivityInput): Promise<AgentBudgetActivityPage> {
    const client = await this.getClient();
    const limit = Math.max(1, Math.min(MAX_ACTIVITY_LIMIT, Math.floor(input.limit ?? 20)));
    const cursor = input.cursor ? new Date(input.cursor.createdAt) : null;
    const cursorWhere =
      cursor && Number.isFinite(cursor.getTime())
        ? {
            OR: [
              { createdAt: { lt: cursor } },
              { createdAt: cursor, id: { lt: input.cursor!.id } },
            ],
          }
        : {};
    const rows = (await client.agentBudgetLedgerEntry.findMany({
      where: {
        bucket: { ownerId: input.ownerId },
        ...cursorWhere,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      select: BUDGET_ENTRY_SELECT as never,
    })) as BudgetLedgerRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      entries: pageRows.map((row) => this.mapActivity(row)),
      nextCursor:
        hasMore && pageRows[pageRows.length - 1]
          ? encodeBudgetActivityCursor(pageRows[pageRows.length - 1])
          : null,
      hasMore,
    };
  }

  async getBudgetSummaryForOwner(ownerId: string): Promise<AgentBudgetSummaryView> {
    const client = await this.getClient();
    await this.expireReservations(ownerId);
    const buckets = (await client.agentBudgetBucket.findMany({
      where: { ownerId },
      orderBy: [
        { periodStart: "desc" },
        { createdAt: "desc" },
      ],
      select: BUDGET_BUCKET_SELECT as never,
    })) as BudgetBucketRow[];

    const committedMicros = buckets.reduce((sum, bucket) => sum + toBigInt(bucket.committedMicros), BigInt(0));
    const reservedMicros = buckets.reduce((sum, bucket) => sum + toBigInt(bucket.reservedMicros), BigInt(0));
    const availableMicros = buckets.reduce((sum, bucket) => {
      const current = toBigInt(bucket.limitMicros) - toBigInt(bucket.committedMicros) - toBigInt(bucket.reservedMicros);
      return sum + (current > BigInt(0) ? current : BigInt(0));
    }, BigInt(0));
    const activeReservations = buckets.reduce(
      (count, bucket) =>
        count +
        (bucket.reservations?.filter(
          (reservation) => reservation.status === "ACTIVE" || reservation.status === "SUBMISSION_UNKNOWN",
        ).length ?? 0),
      0,
    );

    return {
      policies: buckets.map((bucket) => this.mapBucket(bucket)),
      totals: {
        committedUSDC: formatMicrosToUsdcString(committedMicros),
        reservedUSDC: formatMicrosToUsdcString(reservedMicros),
        availableUSDC: formatMicrosToUsdcString(availableMicros),
        activeReservations,
      },
    };
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentBudgetRepositoryClient;
  }

  private async withTransaction<T>(
    client: AgentBudgetRepositoryClient,
    callback: (tx: AgentBudgetRepositoryClient) => Promise<T>,
  ) {
    if (client.$transaction) {
      return client.$transaction((tx) => callback(tx));
    }

    return callback(client);
  }

  private async requireOwnerWallet(client: AgentBudgetRepositoryClient, ownerId: string) {
    const user = await client.user.findUnique({
      where: { id: ownerId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new InputError("owner not found");
    }

    return user.walletAddress;
  }

  private async requireOwnedPolicy(client: AgentBudgetRepositoryClient, ownerId: string, policyId: string): Promise<BudgetPolicyRow> {
    const wallet = await this.requireOwnerWallet(client, ownerId);
    const policy = (await client.agentPolicy.findUnique({
      where: { id: policyId },
      select: {
        id: true,
        agentId: true,
        name: true,
        status: true,
        version: true,
        dailyBudgetUSDC: true,
        remainingBudgetUSDC: true,
        maxPurchaseUSDC: true,
        minimumScore: true,
        manualApprovalRequired: true,
        expiresAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        agent: {
          select: {
            id: true,
            ownerWallet: true,
          },
        },
      } as never,
    })) as BudgetPolicyRow | null;

    if (!policy || policy.agent.ownerWallet !== wallet) {
      throw new InputError("policy not found");
    }

    return policy;
  }

  private async requireOwnedActivePolicy(
    client: AgentBudgetRepositoryClient,
    ownerId: string,
    policyId: string,
  ): Promise<ResolvedBudgetPolicyRow> {
    const policy = await this.requireOwnedPolicy(client, ownerId, policyId);
    if (policy.status !== "ACTIVE" || policy.archivedAt) {
      throw new AgentPolicyConflictError("archived policies cannot be used for new runs");
    }

    if (!policy.manualApprovalRequired) {
      throw new AgentPolicyConflictError("manual approval is required");
    }

    return {
      ...policy,
      dailyBudgetMicros: parsePositiveMicros(policy.dailyBudgetUSDC, "dailyBudgetUSDC"),
    };
  }

  private async requireOwnedExecution(client: AgentBudgetRepositoryClient, ownerId: string, executionId: string): Promise<BudgetExecutionRow> {
    const wallet = await this.requireOwnerWallet(client, ownerId);
    const execution = (await client.agentExecution.findUnique({
      where: { id: executionId },
      select: {
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
        agent: {
          select: {
            id: true,
            ownerWallet: true,
          },
        },
      } as never,
    })) as BudgetExecutionRow | null;

    if (!execution || execution.agent.ownerWallet !== wallet) {
      throw new InputError("execution not found");
    }

    return execution;
  }

  private async getOrCreateBucketRow(
    client: AgentBudgetRepositoryClient,
    ownerId: string,
    policy: ResolvedBudgetPolicyRow,
    periodType: AgentBudgetPeriodType,
  ) {
    const bounds = resolveBudgetPeriodBounds(periodType);
    const existing = (await client.agentBudgetBucket.findUnique({
      where: {
        policyId_periodType_periodStart: {
          policyId: policy.id,
          periodType,
          periodStart: new Date(bounds.periodStart),
        },
      },
      select: BUDGET_BUCKET_SELECT as never,
    })) as BudgetBucketRow | null;

    if (existing) {
      return existing;
    }

    return (await client.agentBudgetBucket.create({
      data: {
        ownerId,
        policyId: policy.id,
        periodType,
        periodStart: new Date(bounds.periodStart),
        periodEnd: new Date(bounds.periodEnd),
        limitMicros: policy.dailyBudgetMicros,
        committedMicros: BigInt(0),
        reservedMicros: BigInt(0),
        version: 1,
      },
      select: BUDGET_BUCKET_SELECT as never,
    })) as BudgetBucketRow;
  }

  private async findCurrentBucket(
    client: AgentBudgetRepositoryClient,
    ownerId: string,
    policyId: string,
    periodType: AgentBudgetPeriodType,
  ) {
    const bounds = resolveBudgetPeriodBounds(periodType);
    const bucket = (await client.agentBudgetBucket.findUnique({
      where: {
        policyId_periodType_periodStart: {
          policyId,
          periodType,
          periodStart: new Date(bounds.periodStart),
        },
      },
      select: BUDGET_BUCKET_SELECT as never,
    })) as BudgetBucketRow | null;

    if (!bucket || bucket.ownerId !== ownerId) {
      return null;
    }

    return bucket;
  }

  private async findBucketById(client: AgentBudgetRepositoryClient, bucketId: string) {
    return (await client.agentBudgetBucket.findFirst({
      where: { id: bucketId },
      select: BUDGET_BUCKET_SELECT as never,
    })) as BudgetBucketRow | null;
  }

  private async updateBucketTotals(
    client: AgentBudgetRepositoryClient,
    bucketId: string,
    input: {
      reservedDeltaMicros?: bigint;
      committedDeltaMicros?: bigint;
    },
  ) {
    const current = await this.findBucketById(client, bucketId);
    if (!current) {
      return null;
    }

    const nextReserved = toBigInt(current.reservedMicros) + (input.reservedDeltaMicros ?? BigInt(0));
    const nextCommitted = toBigInt(current.committedMicros) + (input.committedDeltaMicros ?? BigInt(0));
    const nextLimit = toBigInt(current.limitMicros);

    if (nextReserved < BigInt(0) || nextCommitted < BigInt(0) || nextCommitted + nextReserved > nextLimit) {
      throw new AgentBudgetConflictError("budget limit exceeded");
    }

    const updated = await client.agentBudgetBucket.updateMany({
      where: {
        id: current.id,
        version: current.version,
      },
      data: {
        reservedMicros: nextReserved,
        committedMicros: nextCommitted,
        version: current.version + 1,
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findBucketById(client, bucketId);
  }

  private async findLatestActivityForReservation(client: AgentBudgetRepositoryClient, reservationId: string) {
    const rows = (await client.agentBudgetLedgerEntry.findMany({
      where: { reservationId },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 1,
      select: BUDGET_ENTRY_SELECT as never,
    })) as BudgetLedgerRow[];

    return rows[0] ?? null;
  }

  private assertExecutionMatchesPolicy(
    execution: BudgetExecutionRow,
    policyId: string,
    amountMicros: bigint,
  ) {
    const reasoning = execution.reasoning && typeof execution.reasoning === "object"
      ? (execution.reasoning as Record<string, unknown>)
      : null;
    const policy = reasoning?.policy && typeof reasoning.policy === "object"
      ? (reasoning.policy as Record<string, unknown>)
      : null;
    const snapshotPolicyId = typeof policy?.policyId === "string" ? policy.policyId : null;
    if (snapshotPolicyId && snapshotPolicyId !== policyId) {
      throw new AgentBudgetConflictError("execution policy mismatch");
    }

    const selectedResource = reasoning?.selectedResource && typeof reasoning.selectedResource === "object"
      ? (reasoning.selectedResource as Record<string, unknown>)
      : null;
    const selectedPrice = parsePositiveMicros(selectedResource?.priceUSDC, "priceUSDC", { allowZero: true });
    if (selectedPrice !== amountMicros) {
      throw new AgentBudgetConflictError("reservation amount mismatch");
    }

    if (execution.estimatedCostUSDC !== null) {
      const estimated = parsePositiveMicros(execution.estimatedCostUSDC, "estimatedCostUSDC", { allowZero: true });
      if (estimated !== amountMicros) {
        throw new AgentBudgetConflictError("reservation amount mismatch");
      }
    }
  }

  private mapBucket(row: BudgetBucketRow): AgentBudgetBucketView {
    return toAgentBudgetBucketView(row);
  }

  private mapReservation(row: BudgetReservationRow): AgentBudgetReservationView {
    return toAgentBudgetReservationView(row);
  }

  private mapActivity(row: BudgetLedgerRow): AgentBudgetLedgerEntryView {
    return toAgentBudgetLedgerEntryView(row);
  }

  private buildVirtualBucket(policy: BudgetPolicyRow, periodType: AgentBudgetPeriodType): AgentBudgetBucketView {
    const bounds = resolveBudgetPeriodBounds(periodType);
    const limitMicros = parsePositiveMicros(policy.dailyBudgetUSDC, "dailyBudgetUSDC");
    return {
      bucketId: null,
      ownerId: null,
      policyId: policy.id,
      policyName: policy.name,
      policyVersion: policy.version,
      status: policy.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
      periodType,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      limitUSDC: formatMicrosToUsdcString(limitMicros),
      committedUSDC: "0",
      reservedUSDC: "0",
      availableUSDC: formatMicrosToUsdcString(limitMicros),
      activeReservationCount: 0,
      createdAt: null,
      updatedAt: null,
    };
  }
}

function parsePositiveMicros(
  value: unknown,
  field: string,
  options: { allowZero?: boolean } = {},
) {
  const errors: Record<string, string> = {};
  const micros = normalizeUsdcToMicros(value, errors, field, {
    allowZero: options.allowZero ?? false,
    allowNegative: false,
  });

  if (micros === null) {
    throw new InputError(errors[field] ?? `${field} must be a valid USDC amount`);
  }

  return micros;
}

export function encodeBudgetActivityCursor(row: BudgetLedgerRow) {
  return Buffer.from(
    JSON.stringify({
      createdAt: toIsoString(row.createdAt),
      id: row.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeBudgetActivityCursor(value: string | null | undefined): BudgetActivityCursor | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<BudgetActivityCursor>;
    if (
      typeof parsed.createdAt === "string" &&
      parsed.createdAt.length > 0 &&
      typeof parsed.id === "string" &&
      parsed.id.length > 0
    ) {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toBigInt(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return BigInt(value);
  }

  return BigInt(0);
}
