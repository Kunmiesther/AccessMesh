import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgentBudgetPolicy } from "../../services/agent/BudgetManager";

const policy = {
  remainingBudgetUSDC: 5,
  maxPurchaseUSDC: 2,
  minimumMatchScore: 60,
};

test("rejects prices above max purchase", () => {
  const result = evaluateAgentBudgetPolicy({
    resourcePriceUSDC: 2.5,
    policy,
  });

  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /max purchase limit/i);
});

test("rejects prices above remaining budget", () => {
  const result = evaluateAgentBudgetPolicy({
    resourcePriceUSDC: 5.5,
    policy,
  });

  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /remaining budget/i);
});

test("rejects prices above goal-specific maximum", () => {
  const result = evaluateAgentBudgetPolicy({
    resourcePriceUSDC: 1.1,
    policy: {
      ...policy,
      maxPurchaseUSDC: 10,
      remainingBudgetUSDC: 10,
    },
    goalMaximumPriceUSDC: 1,
  });

  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /goal maximum/i);
});

test("accepts positive prices within all limits", () => {
  const result = evaluateAgentBudgetPolicy({
    resourcePriceUSDC: 1.5,
    policy,
    goalMaximumPriceUSDC: 2,
  });

  assert.equal(result.eligible, true);
  assert.match(result.reasons[0], /within all budget limits/i);
});
