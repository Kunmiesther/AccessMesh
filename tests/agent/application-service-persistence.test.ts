import test from "node:test";
import assert from "node:assert/strict";
import { InputError } from "../../lib/validation";
import { runAgentApplication } from "../../services/agent/AgentApplicationService";
import type { AgentResourceCandidate } from "../../services/agent/types";

const resource: AgentResourceCandidate = {
  id: "candidate-1",
  title: "Agent Runtime Toolkit",
  description: "Toolkit for AccessMesh agent runtime and scoring.",
  priceUSDC: 1,
  resourceType: "CONTENT",
  aiSummary: "Agent runtime toolkit",
  aiTopics: ["agent runtime", "toolkit"],
  aiCategory: "AI Agents",
  aiCollection: "Agent Runtime",
  aiPlacement: "Featured",
  aiReasoning: null,
  publishedAt: "2026-07-24T00:00:00.000Z",
  createdAt: "2026-07-23T00:00:00.000Z",
};

function createPersistenceRepo() {
  const calls: string[] = [];

  return {
    calls,
    repo: {
      async createExecution() {
        calls.push("createExecution");
        return {
          id: "execution-1",
          agentId: "agent-1",
          goal: "Find agent runtime tools",
          status: "CREATED",
          decision: null,
          selectedResourceId: null,
          reasoning: null,
          estimatedCostUSDC: null,
          txHash: null,
          startedAt: "2026-07-28T12:00:00.000Z",
          completedAt: null,
        };
      },
      async markExecutionRunning(executionId: string) {
        calls.push(`markExecutionRunning:${executionId}`);
      },
      async recordRecommendation(executionId: string) {
        calls.push(`recordRecommendation:${executionId}`);
      },
      async failExecution(executionId: string) {
        calls.push(`failExecution:${executionId}`);
      },
    },
  };
}

test("creates an execution before runtime and returns executionId", async () => {
  const { calls, repo } = createPersistenceRepo();
  const result = await runAgentApplication(
    {
      goal: "Find agent runtime tools",
      policy: {
        remainingBudgetUSDC: 5,
        maxPurchaseUSDC: 2,
        minimumMatchScore: 10,
      },
      resourceLimit: 17,
    },
    {
      executionRepository: repo as never,
      ownerId: "owner-1",
      loadCandidates: async (options) => {
        calls.push(`loadCandidates:${options?.limit}`);
        return [resource];
      },
      runRuntime: (input) => {
        calls.push("runRuntime");
        return {
          goal: {
            originalGoal: input.goal,
            normalizedQuery: input.goal.toLowerCase(),
            keywords: ["agent", "runtime", "tools"],
            maximumPriceUSDC: 2,
          },
          decision: "BUY",
          selectedResource: input.resources[0] ?? null,
          selectedEvaluation: null,
          candidates: [],
          trace: [],
        };
      },
    },
  );

  assert.equal(result.executionId, "execution-1");
  assert.deepEqual(calls, [
    "createExecution",
    "markExecutionRunning:execution-1",
    "loadCandidates:17",
    "runRuntime",
    "recordRecommendation:execution-1",
  ]);
});

test("malformed input creates no execution", async () => {
  const { calls, repo } = createPersistenceRepo();

  await assert.rejects(
    () =>
      runAgentApplication(
        {
          goal: "   ",
          policy: {
            remainingBudgetUSDC: 1,
            maxPurchaseUSDC: 1,
            minimumMatchScore: 10,
          },
        },
        {
          executionRepository: repo as never,
          ownerId: "owner-1",
        },
      ),
    (error) => error instanceof InputError && error.message === "goal is required",
  );

  assert.deepEqual(calls, []);
});

test("runtime failure marks the execution failed", async () => {
  const { calls, repo } = createPersistenceRepo();

  await assert.rejects(
    () =>
      runAgentApplication(
        {
          goal: "Find agent runtime tools",
          policy: {
            remainingBudgetUSDC: 5,
            maxPurchaseUSDC: 2,
            minimumMatchScore: 10,
          },
        },
        {
          executionRepository: repo as never,
          ownerId: "owner-1",
          loadCandidates: async () => [resource],
          runRuntime: () => {
            throw new Error("runtime crashed");
          },
        },
      ),
    /runtime crashed/,
  );

  assert.deepEqual(calls, [
    "createExecution",
    "markExecutionRunning:execution-1",
    "failExecution:execution-1",
  ]);
});

test("runs without trusted owner persistence when no ownerId is available", async () => {
  const result = await runAgentApplication(
    {
      goal: "Find agent runtime tools",
      policy: {
        remainingBudgetUSDC: 5,
        maxPurchaseUSDC: 2,
        minimumMatchScore: 10,
      },
    },
    {
      loadCandidates: async () => [resource],
      runRuntime: (input) => ({
        goal: {
          originalGoal: input.goal,
          normalizedQuery: input.goal.toLowerCase(),
          keywords: ["agent", "runtime", "tools"],
        },
        decision: "SKIP",
        selectedResource: null,
        selectedEvaluation: null,
        candidates: [],
        trace: [],
      }),
    },
  );

  assert.equal(result.executionId, null);
  assert.equal(result.decision, "SKIP");
});
