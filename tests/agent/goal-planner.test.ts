import test from "node:test";
import assert from "node:assert/strict";
import { planAgentGoal } from "../../services/agent/GoalPlanner";

test("extracts keywords and removes stop words", () => {
  const plan = planAgentGoal("Please find AI agent runtime tools for me");

  assert.deepEqual(plan.keywords, ["ai", "agent", "runtime", "tools"]);
});

test("detects budget phrases and removes them from the normalized query", () => {
  const cases = [
    {
      goal: "Find docs under 0.20 USDC for agent runtime",
      expectedMaximum: 0.2,
      expectedQuery: "find docs for agent runtime",
    },
    {
      goal: "Search research below 1 USDC",
      expectedMaximum: 1,
      expectedQuery: "search research",
    },
    {
      goal: "Maximum 0.5 USDC payment guide",
      expectedMaximum: 0.5,
      expectedQuery: "payment guide",
    },
    {
      goal: "Need max 2 USDC dataset",
      expectedMaximum: 2,
      expectedQuery: "need dataset",
    },
  ];

  for (const item of cases) {
    const plan = planAgentGoal(item.goal);
    assert.equal(plan.maximumPriceUSDC, item.expectedMaximum);
    assert.equal(plan.normalizedQuery, item.expectedQuery);
  }
});

test("removes duplicate keywords case-insensitively", () => {
  const plan = planAgentGoal("AI ai Agents agents Agent");

  assert.deepEqual(plan.keywords, ["ai", "agents", "agent"]);
});
