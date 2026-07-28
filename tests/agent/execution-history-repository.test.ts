import test from "node:test";
import assert from "node:assert/strict";
import { AgentExecutionRepository } from "../../services/agent/AgentExecutionRepository";

type ExecutionRow = {
  id: string;
  agentId: string;
  goal: string;
  status: string;
  decision: string | null;
  selectedResourceId: string | null;
  reasoning: Record<string, unknown>;
  estimatedCostUSDC: number | null;
  txHash: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

function createHistoryMockClient() {
  const state = {
    users: [
      {
        id: "owner-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        id: "owner-2",
        walletAddress: "0x2222222222222222222222222222222222222222",
      },
    ],
    agents: [
      { id: "agent-1", ownerWallet: "0x1111111111111111111111111111111111111111", name: "AccessMesh Research Agent", status: "ACTIVE" },
      { id: "agent-2", ownerWallet: "0x2222222222222222222222222222222222222222", name: "AccessMesh Research Agent", status: "ACTIVE" },
    ],
    executions: new Map<string, ExecutionRow>(),
  };

  const client: any = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return state.users.find((user) => user.id === where.id) ?? null;
      },
    },
    agent: {
      async findMany({ where }: { where: { ownerWallet: string } }) {
        return state.agents
          .filter((agent) => agent.ownerWallet === where.ownerWallet)
          .map((agent) => ({ id: agent.id }));
      },
      async findFirst() {
        return null;
      },
      async create() {
        throw new Error("not used");
      },
    },
    agentExecution: {
      async findMany({
        where,
        orderBy,
        take,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Array<{ startedAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
        take?: number;
      }) {
        let rows = [...state.executions.values()];

        const agentIds = getStringArray(where?.agentId);
        if (agentIds) {
          rows = rows.filter((row) => agentIds.includes(row.agentId));
        }

        const decision = typeof where?.decision === "string" ? where.decision : null;
        if (decision) {
          rows = rows.filter((row) => row.decision === decision);
        }

        const statusFilter = getStringArray(where?.status);
        if (statusFilter) {
          rows = rows.filter((row) => statusFilter.includes(row.status));
        }

        const cursor = extractCursor(where?.OR);
        if (cursor) {
          rows = rows.filter((row) => {
            if (cursor.direction === "desc") {
              return (
                row.startedAt < cursor.startedAt ||
                (row.startedAt.getTime() === cursor.startedAt.getTime() && row.id < cursor.id)
              );
            }

            return (
              row.startedAt > cursor.startedAt ||
              (row.startedAt.getTime() === cursor.startedAt.getTime() && row.id > cursor.id)
            );
          });
        }

        rows.sort((left, right) => {
          const startedDirection = (((orderBy?.[0] as any)?.startedAt ?? "desc") as "asc" | "desc");
          const started = startedDirection === "desc"
            ? right.startedAt.getTime() - left.startedAt.getTime()
            : left.startedAt.getTime() - right.startedAt.getTime();
          if (started !== 0) {
            return started;
          }

          const idDirection = (((orderBy?.[1] as any)?.id ?? "desc") as "asc" | "desc");
          const idOrder = idDirection === "desc" ? -1 : 1;
          return left.id === right.id ? 0 : left.id > right.id ? idOrder : -idOrder;
        });

        const slice = typeof take === "number" ? rows.slice(0, take) : rows;
        return slice.map((row) => mapExecution(row));
      },
    },
    async $transaction<T>(callback: (tx: typeof client) => Promise<T>) {
      return callback(client);
    },
  };

  return { client, state };
}

function getStringArray(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as { in?: string[] };
  return Array.isArray(record.in) ? record.in : null;
}

function extractCursor(orValue: unknown) {
  if (!Array.isArray(orValue) || orValue.length < 2) {
    return null;
  }

  const first = orValue[0] as { startedAt?: { lt?: Date; gt?: Date } };
  const second = orValue[1] as { startedAt?: Date; id?: { lt?: string; gt?: string } };
  const startedAt = first.startedAt?.lt ?? first.startedAt?.gt;
  const id = second.id?.lt ?? second.id?.gt;

  if (!(startedAt instanceof Date) || typeof id !== "string") {
    return null;
  }

  return {
    startedAt,
    id,
    direction: first.startedAt?.lt ? ("desc" as const) : ("asc" as const),
  };
}

function mapExecution(row: ExecutionRow) {
  return {
    id: row.id,
    agentId: row.agentId,
    goal: row.goal,
    status: row.status,
    decision: row.decision,
    selectedResourceId: row.selectedResourceId,
    reasoning: row.reasoning,
    estimatedCostUSDC: row.estimatedCostUSDC,
    txHash: row.txHash,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function seedExecution(
  state: ReturnType<typeof createHistoryMockClient>["state"],
  row: Partial<ExecutionRow> & Pick<ExecutionRow, "id" | "agentId" | "goal" | "status" | "startedAt">,
) {
  state.executions.set(row.id, {
    id: row.id,
    agentId: row.agentId,
    goal: row.goal,
    status: row.status,
    decision: row.decision ?? null,
    selectedResourceId: row.selectedResourceId ?? null,
    reasoning:
      row.reasoning ??
      {
        version: 1,
        goal: {
          originalGoal: row.goal,
          normalizedQuery: row.goal.toLowerCase(),
          keywords: ["agent"],
        },
        policy: {
          remainingBudgetUSDC: 1,
          maxPurchaseUSDC: 0.25,
          minimumMatchScore: 35,
        },
        normalizedGoal: row.goal.toLowerCase(),
        candidateCount: 1,
        candidateSummaries: [
          {
            resource: {
              id: `${row.id}-resource`,
              title: `${row.goal} resource`,
              description: "Description",
              priceUSDC: 0.2,
              resourceType: "CONTENT",
              aiSummary: "hidden summary",
              aiTopics: ["agent"],
              aiCategory: "AI",
              aiCollection: "Collection",
              aiPlacement: "Featured",
              publishedAt: "2026-07-28T00:00:00.000Z",
              createdAt: "2026-07-28T00:00:00.000Z",
              aiReasoning: "hidden",
            },
            matchScore: 42,
            matchedKeywords: ["agent"],
            budgetEligible: true,
            reasons: ["Keyword match"],
          },
        ],
        selectedResource: {
          id: `${row.id}-resource`,
          title: `${row.goal} resource`,
          description: "Description",
          priceUSDC: 0.2,
          resourceType: "CONTENT",
          aiSummary: "hidden summary",
          aiTopics: ["agent"],
          aiCategory: "AI",
          aiCollection: "Collection",
          aiPlacement: "Featured",
          publishedAt: "2026-07-28T00:00:00.000Z",
          createdAt: "2026-07-28T00:00:00.000Z",
          aiReasoning: "hidden",
        },
        selectedEvaluation: null,
        comparisonSummary: {
          candidateCount: 1,
          budgetEligibleCount: 1,
          selectedCandidateId: `${row.id}-resource`,
          topMatchScore: 42,
          summary: "Selected candidate.",
        },
        trace: [
          {
            step: "decision",
            status: "SUCCESS",
            message: "Selected candidate.",
          },
        ],
        recommendation: {
          decision: (row.decision ?? "SKIP") as "BUY" | "SKIP",
          status: row.status as never,
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
    estimatedCostUSDC: row.estimatedCostUSDC ?? null,
    txHash: row.txHash ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null,
  });
}

test("listExecutionsForOwner returns newest first with stable pagination and limit enforcement", async () => {
  const { client, state } = createHistoryMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  for (let index = 1; index <= 21; index += 1) {
    seedExecution(state, {
      id: `exec-${String(index).padStart(2, "0")}`,
      agentId: "agent-1",
      goal: `Goal ${index}`,
      status: index % 2 === 0 ? "COMPLETED" : "RECOMMENDED_BUY",
      decision: index % 2 === 0 ? "BUY" : "SKIP",
      startedAt: new Date("2026-07-28T12:00:00.000Z"),
      completedAt: index % 2 === 0 ? new Date("2026-07-28T12:30:00.000Z") : null,
    });
  }

  const firstPage = await repository.listExecutionsForOwner({
    ownerId: "owner-1",
    limit: 100,
  });

  assert.equal(firstPage.executions.length, 20);
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.executions[0]?.id, "exec-21");
  assert.equal(firstPage.executions[19]?.id, "exec-02");
  assert.ok(firstPage.nextCursor);

  const secondPage = await repository.listExecutionsForOwner({
    ownerId: "owner-1",
    limit: 100,
    cursor: decodeCursor(firstPage.nextCursor),
  });

  assert.equal(secondPage.executions.length, 1);
  assert.equal(secondPage.executions[0]?.id, "exec-01");
  assert.equal(secondPage.hasMore, false);
});

test("listExecutionsForOwner filters by decision and status and excludes other owners", async () => {
  const { client, state } = createHistoryMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  seedExecution(state, {
    id: "exec-buy",
    agentId: "agent-1",
    goal: "Buy goal",
    status: "COMPLETED",
    decision: "BUY",
    startedAt: new Date("2026-07-28T12:01:00.000Z"),
    completedAt: new Date("2026-07-28T12:05:00.000Z"),
  });
  seedExecution(state, {
    id: "exec-skip",
    agentId: "agent-1",
    goal: "Skip goal",
    status: "RECOMMENDED_SKIP",
    decision: "SKIP",
    startedAt: new Date("2026-07-28T12:02:00.000Z"),
    completedAt: null,
  });
  seedExecution(state, {
    id: "exec-other",
    agentId: "agent-2",
    goal: "Other owner goal",
    status: "COMPLETED",
    decision: "BUY",
    startedAt: new Date("2026-07-28T12:03:00.000Z"),
    completedAt: new Date("2026-07-28T12:06:00.000Z"),
  });

  const buyExecutions = await repository.listExecutionsForOwner({
    ownerId: "owner-1",
    decision: "BUY",
  });

  assert.deepEqual(buyExecutions.executions.map((execution) => execution.id), ["exec-buy"]);

  const completedExecutions = await repository.listExecutionsForOwner({
    ownerId: "owner-1",
    status: "completed",
  });

  assert.deepEqual(completedExecutions.executions.map((execution) => execution.id), ["exec-buy"]);

  const otherOwnerExecutions = await repository.listExecutionsForOwner({
    ownerId: "owner-2",
  });

  assert.deepEqual(otherOwnerExecutions.executions.map((execution) => execution.id), ["exec-other"]);
});

test("listExecutionsForOwner returns summaries without hidden content", async () => {
  const { client, state } = createHistoryMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  seedExecution(state, {
    id: "exec-safe",
    agentId: "agent-1",
    goal: "Safe goal",
    status: "COMPLETED",
    decision: "BUY",
    startedAt: new Date("2026-07-28T12:04:00.000Z"),
    completedAt: new Date("2026-07-28T12:07:00.000Z"),
    reasoning: {
      version: 1,
      goal: {
        originalGoal: "Safe goal",
        normalizedQuery: "safe goal",
        keywords: ["safe"],
      },
      policy: {
        remainingBudgetUSDC: 1,
        maxPurchaseUSDC: 0.25,
        minimumMatchScore: 35,
      },
      normalizedGoal: "safe goal",
      candidateCount: 1,
      candidateSummaries: [],
      selectedResource: {
        id: "resource-safe",
        title: "Safe Resource",
        description: "Description",
        priceUSDC: 0.2,
        resourceType: "CONTENT",
        aiSummary: "hidden summary",
        aiTopics: ["safe"],
        aiCategory: "AI",
        aiCollection: "Collection",
        aiPlacement: "Featured",
        publishedAt: "2026-07-28T00:00:00.000Z",
        createdAt: "2026-07-28T00:00:00.000Z",
        aiReasoning: "hidden reasoning",
      },
      selectedEvaluation: null,
      comparisonSummary: {
        candidateCount: 1,
        budgetEligibleCount: 1,
        selectedCandidateId: "resource-safe",
        topMatchScore: 92,
        summary: "Selected resource-safe.",
      },
      trace: [],
      recommendation: {
        decision: "BUY",
        status: "COMPLETED",
      },
      purchase: {
        status: "COMPLETED",
        settlementStatus: "SETTLED",
        unlockStatus: "UNLOCKED",
        transactionId: "0xabc",
        amountUSDC: 0.2,
        resourceId: "resource-safe",
      },
      failure: null,
    },
  });

  const page = await repository.listExecutionsForOwner({
    ownerId: "owner-1",
  });

  const summary = page.executions[0];
  assert.ok(summary);
  assert.equal(summary.selectedResourceTitle, "Safe Resource");
  assert.equal(JSON.stringify(summary).includes("aiReasoning"), false);
  assert.equal(JSON.stringify(summary).includes("hidden reasoning"), false);
});

function decodeCursor(cursor: string) {
  const normalized = cursor.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64").toString("utf8");
  return JSON.parse(json) as { startedAt: string; id: string };
}
