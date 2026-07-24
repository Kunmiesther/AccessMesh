import test from "node:test";
import assert from "node:assert/strict";
import { handleAgentRunRequest } from "../../app/api/agent/run/route";

test("malformed input returns 400", async () => {
  const request = new Request("http://localhost/api/agent/run", {
    method: "POST",
    body: "not-json",
  });

  const response = await handleAgentRunRequest(request, async () => {
    throw new Error("should not be called");
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "request body must be valid JSON",
  });
});

test("successful request returns a structured result without private content", async () => {
  const request = new Request("http://localhost/api/agent/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      goal: "Find the best Circle CCTP guide under 0.20 USDC",
      policy: {
        remainingBudgetUSDC: 1,
        maxPurchaseUSDC: 0.25,
        minimumMatchScore: 35,
      },
      resourceLimit: 50,
      resourceContent: "should be ignored",
    }),
  });

  const response = await handleAgentRunRequest(request, async (input) => ({
    goal: {
      originalGoal: input.goal,
      normalizedQuery: "circle cctp guide",
      keywords: ["circle", "cctp", "guide"],
      maximumPriceUSDC: 0.2,
    },
    decision: "BUY",
    selectedResource: {
      id: "resource-1",
      title: "Circle CCTP Guide",
      description: "Guide",
      priceUSDC: 0.2,
      resourceType: "CONTENT",
      aiSummary: null,
      aiTopics: ["circle", "cctp"],
      aiCategory: null,
      aiCollection: null,
      aiPlacement: null,
      aiReasoning: null,
      publishedAt: "2026-07-24T00:00:00.000Z",
      createdAt: "2026-07-24T00:00:00.000Z",
    },
    selectedEvaluation: null,
    candidates: [],
    trace: [
      {
        step: "goal_planned",
        status: "SUCCESS",
        message: "ok",
      },
    ],
  }));

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    result: {
      goal: Record<string, unknown>;
      decision: string;
      selectedResource: Record<string, unknown> | null;
      selectedEvaluation: Record<string, unknown> | null;
      candidates: unknown[];
      trace: unknown[];
    };
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.result.decision, "BUY");
  assert.ok(payload.result.selectedResource);
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload.result.selectedResource, "resourceContent"),
    false,
  );
  assert.equal(JSON.stringify(payload).includes("should be ignored"), false);
});
