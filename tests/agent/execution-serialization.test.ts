import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateComparisonSummary,
  sanitizeJsonValue,
  toSerializableCandidateEvaluationSnapshot,
  toSerializableResourceSnapshot,
} from "../../services/agent/AgentExecutionSerialization";

test("safe serialization handles dates, decimals, undefined and large numeric values", () => {
  const value = sanitizeJsonValue({
    createdAt: new Date("2026-07-28T12:00:00.000Z"),
    amountUSDC: {
      constructor: { name: "Decimal" },
      toString: () => "12.3400",
    },
    counter: BigInt("42"),
    missing: undefined,
    notFinite: NaN,
    alsoNotFinite: Infinity,
    items: [1, undefined, BigInt("7"), NaN],
  });

  assert.deepEqual(value, {
    createdAt: "2026-07-28T12:00:00.000Z",
    amountUSDC: "12.3400",
    counter: "42",
    notFinite: null,
    alsoNotFinite: null,
    items: [1, "7", null],
  });
});

test("resource snapshots exclude protected and reasoning-only fields", () => {
  const resource = toSerializableResourceSnapshot({
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
    aiReasoning: "hidden reasoning must not be persisted",
    resourceUrl: "https://example.com/private",
    endpoint: "https://example.com/private-endpoint",
    publishedAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-07-27T00:00:00.000Z",
  } as never);

  assert.equal("aiReasoning" in resource, false);
  assert.equal("resourceUrl" in resource, false);
  assert.equal("endpoint" in resource, false);
});

test("candidate comparison summaries remain structured and safe", () => {
  const summary = buildCandidateComparisonSummary({
    candidates: [
      {
        resource: {
          id: "resource-1",
          title: "Agent Toolkit",
          description: "Toolkit",
          priceUSDC: 1,
          resourceType: "CONTENT",
          aiSummary: "summary",
          aiTopics: ["agent"],
          aiCategory: "AI",
          aiCollection: "Research",
          aiPlacement: "Featured",
          aiReasoning: null,
          publishedAt: "2026-07-28T00:00:00.000Z",
          createdAt: "2026-07-27T00:00:00.000Z",
        },
        matchScore: 91,
        matchedKeywords: ["agent"],
        budgetEligible: true,
        reasons: ["keyword match"],
      },
    ] as never,
    selectedResourceId: "resource-1",
  });

  assert.equal(summary.candidateCount, 1);
  assert.equal(summary.selectedCandidateId, "resource-1");
  assert.match(summary.summary, /Selected resource-1/);
});
