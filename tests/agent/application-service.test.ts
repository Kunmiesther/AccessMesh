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

test("rejects an empty goal", async () => {
  await assert.rejects(
    () =>
      runAgentApplication({
        goal: "   ",
        policy: {
          remainingBudgetUSDC: 1,
          maxPurchaseUSDC: 1,
          minimumMatchScore: 10,
        },
      }),
    (error) => error instanceof InputError && error.message === "goal is required",
  );
});

test("rejects invalid budget policy values", async () => {
  await assert.rejects(
    () =>
      runAgentApplication({
        goal: "Find something",
        policy: {
          remainingBudgetUSDC: -1,
          maxPurchaseUSDC: 1,
          minimumMatchScore: 10,
        },
      }),
    (error) =>
      error instanceof InputError &&
      error.message === "policy.remainingBudgetUSDC must be 0 or greater",
  );
});

test("passes marketplace resources into the runtime", async () => {
  let receivedResources: ReadonlyArray<AgentResourceCandidate> | null = null;
  const sourceResources = [resource];

  const result = await runAgentApplication(
    {
      goal: "agent runtime toolkit",
      policy: {
        remainingBudgetUSDC: 5,
        maxPurchaseUSDC: 2,
        minimumMatchScore: 10,
      },
      resourceLimit: 17,
    },
    {
      loadCandidates: async (options) => {
        assert.equal(options?.limit, 17);
        return sourceResources;
      },
      runRuntime: (input) => {
        receivedResources = input.resources;
        return {
          goal: {
            originalGoal: input.goal,
            normalizedQuery: input.goal.toLowerCase(),
            keywords: ["agent", "runtime", "toolkit"],
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

  assert.equal(result.decision, "BUY");
  assert.ok(receivedResources);
  assert.deepEqual(receivedResources, sourceResources);
  assert.notStrictEqual(receivedResources, sourceResources);
});
