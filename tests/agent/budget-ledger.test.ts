import test from "node:test";
import assert from "node:assert/strict";
import { AgentBudgetRepository, AgentBudgetConflictError } from "../../services/agent/AgentBudgetRepository";
import {
  formatMicrosToUsdcString,
  parseUsdcToMicros,
  resolveBudgetPeriodBounds,
} from "../../services/agent/AgentBudgetValidation";

type BucketRow = {
  id: string;
  ownerId: string;
  policyId: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  limitMicros: bigint;
  committedMicros: bigint;
  reservedMicros: bigint;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  policy: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  reservations: Array<{ id: string; status: string }>;
};

type ReservationRow = {
  id: string;
  bucketId: string;
  executionId: string;
  amountMicros: bigint;
  status: string;
  expiresAt: Date | null;
  committedAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  bucket: BucketRow;
};

type LedgerRow = {
  id: string;
  bucketId: string;
  executionId: string | null;
  reservationId: string | null;
  type: string;
  amountMicros: bigint;
  dedupeKey: string;
  metadata: unknown;
  createdAt: Date;
  bucket: BucketRow;
};

function createBudgetMockClient() {
  const ownerId = "owner-1";
  const walletAddress = "0x1111111111111111111111111111111111111111";
  const policyId = "policy-1";
  const executionId = "execution-1";
  const competingExecutionId = "execution-2";
  const now = new Date("2026-07-29T00:00:00.000Z");
  const bounds = resolveBudgetPeriodBounds("DAILY", now);

  const state = {
    user: { id: ownerId, walletAddress },
    agent: { id: "agent-1", ownerWallet: walletAddress, name: "AccessMesh Research Agent", status: "ACTIVE" },
    policy: {
      id: policyId,
      agentId: "agent-1",
      name: "Balanced Buyer",
      status: "ACTIVE",
      version: 3,
      dailyBudgetUSDC: 2,
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumScore: 70,
      manualApprovalRequired: true,
      expiresAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      agent: {
        id: "agent-1",
        ownerWallet: walletAddress,
      },
    },
    execution: {
      id: executionId,
      agentId: "agent-1",
      goal: "Find the best research guide",
      status: "RECOMMENDED_BUY",
      decision: "BUY" as string | null,
      selectedResourceId: "resource-1",
      reasoning: {
        version: 1,
        goal: {
          originalGoal: "Find the best research guide",
          normalizedQuery: "find the best research guide",
          keywords: ["research", "guide"],
        },
        policy: {
          policyId,
          policyName: "Balanced Buyer",
          policyStatus: "ACTIVE",
          policyVersion: 3,
          policyDescription: "Reusable policy",
          isDefault: true,
          dailyBudgetUSDC: 2,
          remainingBudgetUSDC: 2,
          maxPurchaseUSDC: 1,
          minimumScore: 70,
          manualApprovalRequired: true,
          expiresAt: null,
          overridesApplied: [],
          overrides: {},
        },
        normalizedGoal: "find the best research guide",
        candidateCount: 1,
        candidateSummaries: [],
        selectedResource: {
          id: "resource-1",
          title: "Research Guide",
          description: "Guide",
          priceUSDC: 1,
          resourceType: "CONTENT",
          aiSummary: null,
          aiTopics: [],
          aiCategory: "Research",
          aiCollection: "Guides",
          aiPlacement: "Featured",
          publishedAt: null,
          createdAt: "2026-07-28T00:00:00.000Z",
        },
        selectedEvaluation: null,
        comparisonSummary: {
          candidateCount: 1,
          budgetEligibleCount: 1,
          selectedCandidateId: "resource-1",
          topMatchScore: 88,
          summary: "Selected resource-1 from 1 candidate(s).",
        },
        trace: [],
        recommendation: {
          decision: "BUY",
          status: "RECOMMENDED_BUY",
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
      },
      estimatedCostUSDC: 1,
      txHash: null,
      startedAt: now,
      completedAt: null,
      agent: {
        id: "agent-1",
        ownerWallet: walletAddress,
      },
    },
    competingExecution: {
      id: competingExecutionId,
      agentId: "agent-1",
      goal: "Find the second research guide",
      status: "RECOMMENDED_BUY",
      decision: "BUY" as string | null,
      selectedResourceId: "resource-2",
      reasoning: {
        version: 1,
        goal: {
          originalGoal: "Find the second research guide",
          normalizedQuery: "find the second research guide",
          keywords: ["research", "guide"],
        },
        policy: {
          policyId,
          policyName: "Balanced Buyer",
          policyStatus: "ACTIVE",
          policyVersion: 3,
          policyDescription: "Reusable policy",
          isDefault: true,
          dailyBudgetUSDC: 2,
          remainingBudgetUSDC: 2,
          maxPurchaseUSDC: 1,
          minimumScore: 70,
          manualApprovalRequired: true,
          expiresAt: null,
          overridesApplied: [],
          overrides: {},
        },
        normalizedGoal: "find the second research guide",
        candidateCount: 1,
        candidateSummaries: [],
        selectedResource: {
          id: "resource-2",
          title: "Research Guide 2",
          description: "Guide",
          priceUSDC: 1,
          resourceType: "CONTENT",
          aiSummary: null,
          aiTopics: [],
          aiCategory: "Research",
          aiCollection: "Guides",
          aiPlacement: "Featured",
          publishedAt: null,
          createdAt: "2026-07-28T00:00:00.000Z",
        },
        selectedEvaluation: null,
        comparisonSummary: {
          candidateCount: 1,
          budgetEligibleCount: 1,
          selectedCandidateId: "resource-2",
          topMatchScore: 88,
          summary: "Selected resource-2 from 1 candidate(s).",
        },
        trace: [],
        recommendation: {
          decision: "BUY",
          status: "RECOMMENDED_BUY",
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
      },
      estimatedCostUSDC: 1,
      txHash: null,
      startedAt: now,
      completedAt: null,
      agent: {
        id: "agent-1",
        ownerWallet: walletAddress,
      },
    },
    buckets: new Map<string, BucketRow>(),
    reservations: new Map<string, ReservationRow>(),
    ledger: [] as LedgerRow[],
    counters: {
      bucket: 0,
      reservation: 0,
      ledger: 0,
    },
  };

  function bucketKey(periodStart: Date) {
    return `${policyId}:${periodStart.toISOString()}`;
  }

  function getBucketById(id: string) {
    for (const bucket of state.buckets.values()) {
      if (bucket.id === id) {
        return bucket;
      }
    }

    return null;
  }

  function cloneBucket(bucket: BucketRow): BucketRow {
    return {
      ...bucket,
      policy: { ...bucket.policy },
      reservations: bucket.reservations.map((reservation) => ({ ...reservation })),
    };
  }

  function withBucketRelations(bucket: BucketRow) {
    return cloneBucket(bucket);
  }

  function createBucketRecord(periodStart: Date, periodEnd: Date): BucketRow {
    return {
      id: `bucket-${++state.counters.bucket}`,
      ownerId,
      policyId,
      periodType: "DAILY",
      periodStart,
      periodEnd,
      limitMicros: BigInt(2_000_000),
      committedMicros: BigInt(0),
      reservedMicros: BigInt(0),
      version: 1,
      createdAt: now,
      updatedAt: now,
      policy: {
        id: policyId,
        name: "Balanced Buyer",
        version: 3,
        status: "ACTIVE",
      },
      reservations: [],
    };
  }

  const client: any = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return where.id === state.user.id ? state.user : null;
      },
    },
    agent: {
      async findFirst({ where }: { where: { ownerWallet: string; name: string } }) {
        return where.ownerWallet === state.agent.ownerWallet && where.name === state.agent.name
          ? state.agent
          : null;
      },
    },
    agentPolicy: {
      async findUnique({ where }: { where: { id: string } }) {
        return where.id === state.policy.id ? state.policy : null;
      },
    },
    agentExecution: {
      async findUnique({ where }: { where: { id: string } }) {
        if (where.id === state.execution.id) {
          return state.execution;
        }

        if (where.id === state.competingExecution.id) {
          return state.competingExecution;
        }

        return null;
      },
    },
    agentBudgetBucket: {
      async findUnique({ where }: { where: { policyId_periodType_periodStart: { policyId: string; periodType: string; periodStart: Date } } }) {
        return state.buckets.get(bucketKey(where.policyId_periodType_periodStart.periodStart)) ?? null;
      },
      async findFirst({ where }: { where?: Record<string, unknown> }) {
        if (where && typeof where.id === "string") {
          return getBucketById(where.id) ?? null;
        }

        return null;
      },
      async findMany({ where }: { where?: Record<string, unknown> }) {
        const buckets = [...state.buckets.values()];
        if (!where || !where.ownerId) {
          return buckets.map(withBucketRelations);
        }

        return buckets.filter((bucket) => bucket.ownerId === where.ownerId).map(withBucketRelations);
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const bucket = createBucketRecord(new Date(String(data.periodStart)), new Date(String(data.periodEnd)));
        bucket.ownerId = String(data.ownerId);
        bucket.limitMicros = BigInt(String(data.limitMicros ?? 0));
        state.buckets.set(bucketKey(bucket.periodStart), bucket);
        return withBucketRelations(bucket);
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const bucket = getBucketById(where.id);
        if (!bucket) {
          throw new Error("bucket not found");
        }

        if ("reservedMicros" in data) {
          bucket.reservedMicros = BigInt(String(data.reservedMicros));
        }
        if ("committedMicros" in data) {
          bucket.committedMicros = BigInt(String(data.committedMicros));
        }
        if (typeof data.version === "number") {
          bucket.version = data.version;
        }
        if (data.updatedAt instanceof Date) {
          bucket.updatedAt = data.updatedAt;
        }

        return withBucketRelations(bucket);
      },
      async updateMany({ where, data }: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
        const bucket = where && typeof where.id === "string" ? getBucketById(where.id) : null;
        if (!bucket) {
          return { count: 0 };
        }

        if (where && typeof where.version === "number" && bucket.version !== where.version) {
          return { count: 0 };
        }

        if ("reservedMicros" in data) {
          bucket.reservedMicros = BigInt(String(data.reservedMicros));
        }
        if ("committedMicros" in data) {
          bucket.committedMicros = BigInt(String(data.committedMicros));
        }
        if (typeof data.version === "number") {
          bucket.version = data.version;
        }
        if (data.updatedAt instanceof Date) {
          bucket.updatedAt = data.updatedAt;
        }

        return { count: 1 };
      },
      async upsert({ create }: { create: Record<string, unknown> }) {
        const periodStart = new Date(String(create.periodStart));
        const key = bucketKey(periodStart);
        const existing = state.buckets.get(key);
        if (existing) {
          return withBucketRelations(existing);
        }

        const bucket = createBucketRecord(periodStart, new Date(String(create.periodEnd)));
        bucket.ownerId = String(create.ownerId);
        bucket.limitMicros = BigInt(String(create.limitMicros ?? 0));
        state.buckets.set(key, bucket);
        return withBucketRelations(bucket);
      },
    },
    agentBudgetReservation: {
      async findUnique({ where }: { where: { id?: string; executionId?: string } }) {
        if (where.id) {
          return state.reservations.get(where.id) ?? null;
        }

        if (where.executionId) {
          return [...state.reservations.values()].find((reservation) => reservation.executionId === where.executionId) ?? null;
        }

        return null;
      },
      async findMany({ where }: { where?: Record<string, unknown> }) {
        let values = [...state.reservations.values()];
        if (where?.status && typeof where.status === "string") {
          values = values.filter((reservation) => reservation.status === where.status);
        }
        if (where?.bucket && typeof where.bucket === "object") {
          const bucketWhere = where.bucket as Record<string, unknown>;
          if (typeof bucketWhere.ownerId === "string") {
            values = values.filter((reservation) => reservation.bucket.ownerId === bucketWhere.ownerId);
          }
        }
        return values;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const bucket = getBucketById(String(data.bucketId));
        if (!bucket) {
          throw new Error("bucket not found");
        }

        const reservation: ReservationRow = {
          id: `reservation-${++state.counters.reservation}`,
          bucketId: bucket.id,
          executionId: String(data.executionId),
          amountMicros: BigInt(String(data.amountMicros)),
          status: String(data.status),
          expiresAt: data.expiresAt instanceof Date ? data.expiresAt : null,
          committedAt: null,
          releasedAt: null,
          releaseReason: null,
          createdAt: now,
          updatedAt: now,
          bucket,
        };

        state.reservations.set(reservation.id, reservation);
        bucket.reservations.push({ id: reservation.id, status: reservation.status });
        return reservation;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const reservation = state.reservations.get(where.id);
        if (!reservation) {
          throw new Error("reservation not found");
        }

        if (typeof data.status === "string") {
          reservation.status = data.status;
        }
        if (data.committedAt instanceof Date) {
          reservation.committedAt = data.committedAt;
        }
        if (data.releasedAt instanceof Date) {
          reservation.releasedAt = data.releasedAt;
        }
        if (typeof data.releaseReason === "string") {
          reservation.releaseReason = data.releaseReason;
        }
        reservation.updatedAt = now;
        reservation.bucket = getBucketById(reservation.bucketId)!;
        return reservation;
      },
      async updateMany({ where, data }: { where?: Record<string, unknown>; data: Record<string, unknown> }) {
        let count = 0;
        for (const reservation of state.reservations.values()) {
          if (where?.status && reservation.status !== where.status) {
            continue;
          }
          if (where?.expiresAt && typeof where.expiresAt === "object") {
            const expiresWhere = where.expiresAt as Record<string, unknown>;
            if (expiresWhere.not === null && reservation.expiresAt === null) {
              continue;
            }
            if (expiresWhere.lt instanceof Date && !(reservation.expiresAt && reservation.expiresAt < expiresWhere.lt)) {
              continue;
            }
          }

          if (typeof data.status === "string") {
            reservation.status = data.status;
          }
          if (data.decidedAt instanceof Date) {
            reservation.updatedAt = data.decidedAt;
          }
          count += 1;
        }

        return { count };
      },
    },
    agentBudgetLedgerEntry: {
      async findMany({ where, orderBy, take }: { where?: Record<string, unknown>; orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>; take?: number }) {
        let entries = [...state.ledger];
        if (where?.reservationId && typeof where.reservationId === "string") {
          entries = entries.filter((entry) => entry.reservationId === where.reservationId);
        }
        if (where?.bucket && typeof where.bucket === "object") {
          const bucketWhere = where.bucket as Record<string, unknown>;
          if (typeof bucketWhere.ownerId === "string") {
            entries = entries.filter((entry) => entry.bucket.ownerId === bucketWhere.ownerId);
          }
        }

        entries.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
        return typeof take === "number" ? entries.slice(0, take) : entries;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const bucket = getBucketById(String(data.bucketId));
        if (!bucket) {
          throw new Error("bucket not found");
        }

        const entry: LedgerRow = {
          id: `entry-${++state.counters.ledger}`,
          bucketId: bucket.id,
          executionId: (data.executionId as string | null) ?? null,
          reservationId: (data.reservationId as string | null) ?? null,
          type: String(data.type),
          amountMicros: BigInt(String(data.amountMicros)),
          dedupeKey: String(data.dedupeKey),
          metadata: data.metadata ?? null,
          createdAt: now,
          bucket,
        };

        state.ledger.push(entry);
        return entry;
      },
    },
    async $transaction<T>(callback: (tx: typeof client) => Promise<T>) {
      return callback(client);
    },
  };

  state.buckets.set(
    bucketKey(new Date(bounds.periodStart)),
    createBucketRecord(new Date(bounds.periodStart), new Date(bounds.periodEnd)),
  );

  return { client, state, ownerId, policyId, executionId };
}

test("parseUsdcToMicros converts exact micros safely", () => {
  const result = parseUsdcToMicros("1.234567", "amountUSDC");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.micros, BigInt(1_234_567));
    assert.equal(result.value.usdc, "1.234567");
  }
  assert.equal(formatMicrosToUsdcString(BigInt(1_234_567)), "1.234567");
});

test("resolveBudgetPeriodBounds uses UTC day boundaries", () => {
  const bounds = resolveBudgetPeriodBounds("DAILY", new Date("2026-07-29T15:30:00.000Z"));
  assert.equal(bounds.periodStart, "2026-07-29T00:00:00.000Z");
  assert.equal(bounds.periodEnd, "2026-07-30T00:00:00.000Z");
});

test("reserve commit and release update bucket totals transaction-safely", async () => {
  const { client, state, ownerId, policyId, executionId } = createBudgetMockClient();
  const repository = new AgentBudgetRepository(async () => client as never);

  const reserve = await repository.reserveBudgetForExecution({
    ownerId,
    policyId,
    executionId,
    amountUSDC: "1",
  });

  assert.equal(reserve.reservation.status, "ACTIVE");
  assert.equal(reserve.bucket.reservedUSDC, "1");
  assert.equal(reserve.bucket.availableUSDC, "1");

  const committed = await repository.commitReservation({
    ownerId,
    policyId,
    executionId,
    transactionId: "0xabc",
    amountUSDC: "1",
    resourceId: "resource-1",
  });

  assert.equal(committed.reservation.status, "COMMITTED");
  assert.equal(committed.bucket.reservedUSDC, "0");
  assert.equal(committed.bucket.committedUSDC, "1");
  assert.ok(state.ledger.filter((entry) => entry.type === "COMMITMENT").length >= 1);

  await assert.rejects(
    () =>
      repository.releaseReservation({
        ownerId,
        policyId,
        executionId,
        reason: "EXECUTION_INVALIDATED",
        amountUSDC: "1",
      }),
    (error: unknown) => error instanceof AgentBudgetConflictError,
  );
});

test("duplicate reservation with mismatched amount conflicts", async () => {
  const { client, state, ownerId, policyId, executionId } = createBudgetMockClient();
  state.execution.estimatedCostUSDC = 1.5;
  if (state.execution.reasoning && typeof state.execution.reasoning === "object") {
    const reasoning = state.execution.reasoning as Record<string, unknown>;
    const selectedResource = reasoning.selectedResource as Record<string, unknown> | undefined;
    if (selectedResource) {
      selectedResource.priceUSDC = 1.5;
    }
    reasoning.estimatedCostUSDC = 1.5;
  }
  const repository = new AgentBudgetRepository(async () => client as never);

  await repository.reserveBudgetForExecution({
    ownerId,
    policyId,
    executionId,
    amountUSDC: "1.5",
  });

  await assert.rejects(
    () =>
      repository.reserveBudgetForExecution({
        ownerId,
        policyId,
        executionId,
        amountUSDC: "1",
      }),
    (error: unknown) => error instanceof AgentBudgetConflictError,
  );
});
