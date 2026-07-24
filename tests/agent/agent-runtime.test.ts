import test from "node:test";
import assert from "node:assert/strict";
import { runAgentRuntime } from "../../services/agent/AgentRuntime";

const referenceDate = new Date("2026-07-24T00:00:00.000Z");
const policy = {
  remainingBudgetUSDC: 5,
  maxPurchaseUSDC: 3,
  minimumMatchScore: 30,
};

const resources = [
  {
    id: "alpha",
    title: "Agent Runtime Toolkit",
    description: "Toolkit for AccessMesh agent runtime and scoring.",
    priceUSDC: 1,
    resourceType: "CONTENT",
    aiSummary: "Agent runtime toolkit for buying premium knowledge.",
    aiTopics: ["agent runtime", "toolkit"],
    aiCategory: "AI Agents",
    aiCollection: "Agent Runtime",
    aiPlacement: "Featured",
    aiReasoning: null,
    publishedAt: "2026-07-23T00:00:00.000Z",
    createdAt: "2026-07-22T00:00:00.000Z",
  },
  {
    id: "beta",
    title: "General Notes",
    description: "Unrelated content.",
    priceUSDC: 1,
    resourceType: "CONTENT",
    aiSummary: null,
    aiTopics: [],
    aiCategory: null,
    aiCollection: null,
    aiPlacement: null,
    aiReasoning: null,
    publishedAt: "2026-07-23T00:00:00.000Z",
    createdAt: "2026-07-22T00:00:00.000Z",
  },
];

test("returns a BUY decision with the best candidate and a full trace", () => {
  const result = runAgentRuntime({
    goal: "Need agent runtime toolkit under 3 USDC",
    policy,
    resources,
    referenceDate,
  });

  assert.equal(result.decision, "BUY");
  assert.equal(result.selectedResource?.id, "alpha");
  assert.equal(result.trace.length, 3);
  assert.equal(result.trace[0].step, "goal_planned");
  assert.equal(result.trace[2].status, "SUCCESS");
});

test("is deterministic for identical input", () => {
  const first = runAgentRuntime({
    goal: "Need agent runtime toolkit under 3 USDC",
    policy,
    resources,
    referenceDate,
  });
  const second = runAgentRuntime({
    goal: "Need agent runtime toolkit under 3 USDC",
    policy,
    resources,
    referenceDate,
  });

  assert.deepEqual(second, first);
});
