import test from "node:test";
import assert from "node:assert/strict";
import { planAgentGoal } from "../../services/agent/GoalPlanner";
import {
  rankAgentResourceCandidates,
  selectAgentResourceCandidate,
} from "../../services/agent/ResourceSelector";

const referenceDate = new Date("2026-07-24T00:00:00.000Z");
const policy = {
  remainingBudgetUSDC: 5,
  maxPurchaseUSDC: 5,
  minimumMatchScore: 25,
};

function resource(overrides: Partial<{
  id: string;
  title: string;
  description: string;
  priceUSDC: number;
  resourceType: string;
  aiSummary: string | null;
  aiTopics: string[];
  aiCategory: string | null;
  aiCollection: string | null;
  aiPlacement: string | null;
  aiReasoning: string | null;
  publishedAt: string | null;
  createdAt: string;
}> = {}) {
  return {
    id: "resource-a",
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
    ...overrides,
  };
}

test("ranks budget eligible candidates before ineligible ones", () => {
  const goal = planAgentGoal("agent runtime toolkit");
  const ranked = rankAgentResourceCandidates({
    goal,
    policy,
    referenceDate,
    resources: [
      resource({
        id: "ineligible-high-score",
        priceUSDC: 8,
        aiSummary: "agent runtime toolkit",
      }),
      resource({
        id: "eligible-medium-score",
        priceUSDC: 1,
        aiSummary: "agent runtime toolkit",
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
      resource({
        id: "eligible-low-score",
        priceUSDC: 1,
        title: "Toolkit Notes",
        description: "Short toolkit notes.",
        aiSummary: null,
        aiTopics: [],
        aiCategory: null,
        aiCollection: null,
        aiPlacement: null,
        publishedAt: "2026-07-20T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(
    ranked.map((item) => item.resource.id),
    ["eligible-medium-score", "eligible-low-score", "ineligible-high-score"],
  );
});

test("exact topic match outranks weak description match", () => {
  const goal = planAgentGoal("agent runtime");
  const ranked = rankAgentResourceCandidates({
    goal,
    policy,
    referenceDate,
    resources: [
      resource({
        id: "description-match",
        title: "General Notes",
        description: "Contains agent runtime terms in passing.",
        aiSummary: null,
        aiTopics: [],
        aiCategory: null,
        aiCollection: null,
        aiPlacement: null,
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
      resource({
        id: "topic-match",
        title: "General Notes",
        description: "Unrelated reference material.",
        aiSummary: null,
        aiTopics: ["agent runtime"],
        aiCategory: null,
        aiCollection: null,
        aiPlacement: null,
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
    ],
  });

  assert.equal(ranked[0].resource.id, "topic-match");
  assert.ok(ranked[0].matchScore > ranked[1].matchScore);
});

test("newer publication breaks a tied score", () => {
  const goal = planAgentGoal("agent runtime");
  const ranked = rankAgentResourceCandidates({
    goal,
    policy,
    referenceDate,
    resources: [
      resource({
        id: "older",
        title: "Agent Runtime Toolkit",
        publishedAt: "2026-07-20T00:00:00.000Z",
      }),
      resource({
        id: "newer",
        title: "Agent Runtime Toolkit",
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(
    ranked.map((item) => item.resource.id),
    ["newer", "older"],
  );
});

test("lower price breaks a remaining tie", () => {
  const goal = planAgentGoal("agent runtime");
  const ranked = rankAgentResourceCandidates({
    goal,
    policy,
    referenceDate,
    resources: [
      resource({
        id: "higher-price",
        priceUSDC: 2,
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
      resource({
        id: "lower-price",
        priceUSDC: 1,
        publishedAt: "2026-07-23T00:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(
    ranked.map((item) => item.resource.id),
    ["lower-price", "higher-price"],
  );
});

test("skips selection when all candidates exceed budget", () => {
  const goal = planAgentGoal("agent runtime");
  const selection = selectAgentResourceCandidate({
    goal,
    policy,
    referenceDate,
    resources: [
      resource({ id: "one", priceUSDC: 6 }),
      resource({ id: "two", priceUSDC: 7 }),
    ],
  });

  assert.equal(selection.decision, "SKIP");
  assert.equal(selection.selectedResource, null);
});

test("skips selection when all scores are below threshold", () => {
  const goal = planAgentGoal("unmatched niche term");
  const selection = selectAgentResourceCandidate({
    goal,
    policy: {
      ...policy,
      minimumMatchScore: 20,
    },
    referenceDate,
    resources: [
      resource({
        id: "low-score",
        title: "General Knowledge",
        description: "Unrelated content.",
        aiSummary: null,
        aiTopics: [],
        aiCategory: null,
        aiCollection: null,
        aiPlacement: null,
        publishedAt: "2025-01-01T00:00:00.000Z",
      }),
    ],
  });

  assert.equal(selection.decision, "SKIP");
  assert.equal(selection.selectedResource, null);
});
