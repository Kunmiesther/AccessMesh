import test from "node:test";
import assert from "node:assert/strict";
import { AgentExecutionRepository } from "../../services/agent/AgentExecutionRepository";
import {
  toSerializableCandidateEvaluationSnapshot,
  toSerializableResourceSnapshot,
} from "../../services/agent/AgentExecutionSerialization";

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

function createMockClient() {
  const state = {
    users: [
      {
        id: "owner-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
    ],
    agents: [] as Array<{ id: string; ownerWallet: string; name: string; status: string; createdAt: Date }>,
    executions: new Map<string, ExecutionRow>(),
    counters: {
      agent: 0,
      execution: 0,
    },
  };

  type MockClient = {
    user: {
      findUnique(args: { where: { id: string } }): Promise<{ id: string; walletAddress: string } | null>;
    };
    agent: {
      findFirst(args: { where: { ownerWallet: string; name: string } }): Promise<{ id: string; ownerWallet: string; name: string; status: string; createdAt: Date } | null>;
      create(args: { data: { ownerWallet: string; name: string; status: string } }): Promise<{ id: string; ownerWallet: string; name: string; status: string; createdAt: Date }>;
    };
    agentExecution: {
      create(args: { data: Record<string, unknown> }): Promise<ReturnType<typeof mapExecution>>;
      findUnique(args: { where: { id: string } }): Promise<ReturnType<typeof mapExecution> | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ReturnType<typeof mapExecution>>;
    };
    $transaction<T>(callback: (tx: MockClient) => Promise<T>): Promise<T>;
  };

  let client!: MockClient;

  client = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return state.users.find((user) => user.id === where.id) ?? null;
      },
    },
    agent: {
      async findFirst({ where }: { where: { ownerWallet: string; name: string } }) {
        return (
          state.agents.find(
            (agent) => agent.ownerWallet === where.ownerWallet && agent.name === where.name,
          ) ?? null
        );
      },
      async create({ data }: { data: { ownerWallet: string; name: string; status: string } }) {
        const agent = {
          id: `agent-${++state.counters.agent}`,
          ownerWallet: data.ownerWallet,
          name: data.name,
          status: data.status,
          createdAt: new Date("2026-07-28T12:00:00.000Z"),
        };
        state.agents.push(agent);
        return agent;
      },
    },
    agentExecution: {
      async create({ data }: { data: Record<string, unknown> }) {
        const execution: ExecutionRow = {
          id: `execution-${++state.counters.execution}`,
          agentId: String(data.agentId),
          goal: String(data.goal),
          status: String(data.status),
          decision: (data.decision as string | null) ?? null,
          selectedResourceId: (data.selectedResourceId as string | null) ?? null,
          reasoning: data.reasoning as Record<string, unknown>,
          estimatedCostUSDC:
            typeof data.estimatedCostUSDC === "number" ? data.estimatedCostUSDC : null,
          txHash: typeof data.txHash === "string" ? data.txHash : null,
          startedAt: new Date("2026-07-28T12:00:00.000Z"),
          completedAt: null,
        };
        state.executions.set(execution.id, execution);
        return mapExecution(execution);
      },
      async findUnique({ where }: { where: { id: string } }) {
        const execution = state.executions.get(where.id);
        return execution ? mapExecution(execution) : null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const execution = state.executions.get(where.id);
        if (!execution) {
          throw new Error("execution not found");
        }

        if (typeof data.status === "string") {
          execution.status = data.status;
        }
        if ("decision" in data) {
          execution.decision = (data.decision as string | null) ?? null;
        }
        if ("selectedResourceId" in data) {
          execution.selectedResourceId = (data.selectedResourceId as string | null) ?? null;
        }
        if ("reasoning" in data) {
          execution.reasoning = data.reasoning as Record<string, unknown>;
        }
        if ("estimatedCostUSDC" in data) {
          execution.estimatedCostUSDC =
            typeof data.estimatedCostUSDC === "number" ? data.estimatedCostUSDC : null;
        }
        if ("txHash" in data) {
          execution.txHash = typeof data.txHash === "string" ? data.txHash : null;
        }
        if ("completedAt" in data) {
          execution.completedAt = data.completedAt instanceof Date ? data.completedAt : null;
        }

        return mapExecution(execution);
      },
    },
    async $transaction<T>(callback: (tx: MockClient) => Promise<T>) {
      return callback(client);
    },
  };

  return { client, state };
}

function mapExecution(execution: ExecutionRow) {
  return {
    id: execution.id,
    agentId: execution.agentId,
    goal: execution.goal,
    status: execution.status,
    decision: execution.decision,
    selectedResourceId: execution.selectedResourceId,
    reasoning: execution.reasoning,
    estimatedCostUSDC: execution.estimatedCostUSDC,
    txHash: execution.txHash,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
  };
}

function buildCandidate() {
  return {
    id: "resource-1",
    title: "Agent Toolkit",
    description: "Toolkit",
    priceUSDC: 1,
    resourceType: "CONTENT",
    aiSummary: "summary",
    aiTopics: ["agent", "runtime"],
    aiCategory: "AI",
    aiCollection: "Research",
    aiPlacement: "Featured",
    aiReasoning: "hidden",
    publishedAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-07-27T00:00:00.000Z",
  } as const;
}

test("createExecution reuses the default agent for the same owner", async () => {
  const { client, state } = createMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  const first = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find agent runtime tools",
      normalizedQuery: "find agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find agent runtime tools",
    candidateCount: 2,
  });

  const second = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find more agent runtime tools",
      normalizedQuery: "find more agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find more agent runtime tools",
    candidateCount: 1,
  });

  assert.equal(state.agents.length, 1);
  assert.equal(first.agentId, second.agentId);
  assert.equal(first.status, "CREATED");
  assert.equal(first.reasoning?.purchase.status, "NOT_STARTED");
});

test("recording recommendations preserves safe resource snapshots", async () => {
  const { client } = createMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  const execution = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find agent runtime tools",
      normalizedQuery: "find agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find agent runtime tools",
  });

  await repository.markExecutionRunning(execution.id);
  const recommended = await repository.recordRecommendation(execution.id, {
    decision: "BUY",
    candidateCount: 1,
    comparisonSummary: {
      candidateCount: 1,
      budgetEligibleCount: 1,
      selectedCandidateId: "resource-1",
      topMatchScore: 92,
      summary: "Selected resource-1 from 1 candidate(s).",
    },
    candidateSummaries: [
      toSerializableCandidateEvaluationSnapshot({
        resource: buildCandidate(),
        matchScore: 92,
        matchedKeywords: ["agent", "runtime"],
        budgetEligible: true,
        reasons: ["keyword match"],
      } as never),
    ],
    selectedResource: toSerializableResourceSnapshot(buildCandidate() as never),
    selectedEvaluation: toSerializableCandidateEvaluationSnapshot({
      resource: buildCandidate(),
      matchScore: 92,
      matchedKeywords: ["agent", "runtime"],
      budgetEligible: true,
      reasons: ["keyword match"],
    } as never),
    trace: [
      {
        step: "decision",
        status: "SUCCESS",
        message: "Selected the best candidate.",
      },
    ],
    estimatedCostUSDC: 0.25,
  });

  assert.equal(recommended.status, "RECOMMENDED_BUY");
  assert.equal(recommended.selectedResourceId, "resource-1");
  assert.equal(recommended.reasoning?.selectedResource?.id, "resource-1");
  assert.equal("aiReasoning" in (recommended.reasoning?.selectedResource ?? {}), false);
});

test("terminal executions cannot be mutated", async () => {
  const { client } = createMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  const execution = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find agent runtime tools",
      normalizedQuery: "find agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find agent runtime tools",
  });

  await repository.markExecutionRunning(execution.id);
  await repository.recordRecommendation(execution.id, {
    decision: "SKIP",
    candidateCount: 0,
    comparisonSummary: {
      candidateCount: 0,
      budgetEligibleCount: 0,
      selectedCandidateId: null,
      topMatchScore: null,
      summary: "No candidate met the threshold.",
    },
    candidateSummaries: [],
    selectedResource: null,
    selectedEvaluation: null,
    trace: [],
  });

  await assert.rejects(
    () =>
      repository.markExecutionRunning(execution.id),
    /terminal|Invalid execution status transition/i,
  );
});

test("repeated identical completion is idempotent", async () => {
  const { client } = createMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  const execution = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find agent runtime tools",
      normalizedQuery: "find agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find agent runtime tools",
  });

  await repository.markExecutionRunning(execution.id);
  await repository.recordRecommendation(execution.id, {
    decision: "BUY",
    candidateCount: 1,
    comparisonSummary: {
      candidateCount: 1,
      budgetEligibleCount: 1,
      selectedCandidateId: "resource-1",
      topMatchScore: 92,
      summary: "Selected resource-1 from 1 candidate(s).",
    },
    candidateSummaries: [],
    selectedResource: toSerializableResourceSnapshot(buildCandidate() as never),
    selectedEvaluation: null,
    trace: [],
  });
  await repository.markAwaitingApproval(execution.id);
  await repository.recordPaymentSubmitted(execution.id, {
    transactionId: "0xaaaa",
    amountUSDC: 0.25,
    resourceId: "resource-1",
    resourceTitle: "Agent Toolkit",
  });
  await repository.markSettlementVerification(execution.id, {
    status: "VERIFYING",
    transactionId: "0xaaaa",
  });
  await repository.markUnlocking(execution.id, {
    status: "UNLOCKING",
    transactionId: "0xaaaa",
    unlocked: false,
  });

  const first = await repository.completeExecution(execution.id, {
    transactionId: "0xaaaa",
    amountUSDC: 0.25,
    resourceId: "resource-1",
  });
  const second = await repository.completeExecution(execution.id, {
    transactionId: "0xaaaa",
    amountUSDC: 0.25,
    resourceId: "resource-1",
  });

  assert.deepEqual(second, first);
  assert.equal(first.status, "COMPLETED");
  assert.equal(first.completedAt, second.completedAt);
});

test("payment transaction identifier cannot be changed", async () => {
  const { client } = createMockClient();
  const repository = new AgentExecutionRepository(async () => client as never);

  const execution = await repository.createExecution({
    ownerId: "owner-1",
    goal: {
      originalGoal: "Find agent runtime tools",
      normalizedQuery: "find agent runtime tools",
      keywords: ["agent", "runtime", "tools"],
    },
    policySnapshot: {
      remainingBudgetUSDC: 2,
      maxPurchaseUSDC: 1,
      minimumMatchScore: 35,
    },
    normalizedGoal: "find agent runtime tools",
  });

  await repository.markExecutionRunning(execution.id);
  await repository.recordRecommendation(execution.id, {
    decision: "BUY",
    candidateCount: 1,
    comparisonSummary: {
      candidateCount: 1,
      budgetEligibleCount: 1,
      selectedCandidateId: "resource-1",
      topMatchScore: 92,
      summary: "Selected resource-1 from 1 candidate(s).",
    },
    candidateSummaries: [],
    selectedResource: toSerializableResourceSnapshot(buildCandidate() as never),
    selectedEvaluation: null,
    trace: [],
  });
  await repository.markAwaitingApproval(execution.id);

  await repository.recordPaymentSubmitted(execution.id, {
    transactionId: "0xaaaa",
    amountUSDC: 0.25,
    resourceId: "resource-1",
    resourceTitle: "Agent Toolkit",
  });

  await assert.rejects(
    () =>
      repository.recordPaymentSubmitted(execution.id, {
        transactionId: "0xbbbb",
        amountUSDC: 0.25,
        resourceId: "resource-1",
        resourceTitle: "Agent Toolkit",
      }),
    /payment transaction identifier cannot be changed/i,
  );
});
