import test from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedAgentExecutionTransitions,
  isTerminalAgentExecutionStatus,
  validateAgentExecutionTransition,
} from "../../services/agent/AgentExecutionTransitions";

test("valid agent execution transitions are allowed", () => {
  const validPairs: Array<[string, string]> = [
    ["CREATED", "RUNNING"],
    ["RUNNING", "RECOMMENDED_BUY"],
    ["RUNNING", "RECOMMENDED_SKIP"],
    ["RECOMMENDED_BUY", "AWAITING_APPROVAL"],
    ["AWAITING_APPROVAL", "PAYMENT_SUBMITTED"],
    ["PAYMENT_SUBMITTED", "VERIFYING_SETTLEMENT"],
    ["VERIFYING_SETTLEMENT", "UNLOCKING"],
    ["UNLOCKING", "COMPLETED"],
    ["RUNNING", "FAILED"],
  ];

  for (const [from, to] of validPairs) {
    assert.doesNotThrow(() =>
      validateAgentExecutionTransition({
        from: from as never,
        to: to as never,
      }),
    );
  }
});

test("invalid agent execution transitions are rejected", () => {
  const invalidPairs: Array<[string, string]> = [
    ["RECOMMENDED_SKIP", "PAYMENT_SUBMITTED"],
    ["FAILED", "COMPLETED"],
    ["COMPLETED", "RUNNING"],
    ["UNLOCKING", "PAYMENT_SUBMITTED"],
  ];

  for (const [from, to] of invalidPairs) {
    assert.throws(
      () =>
        validateAgentExecutionTransition({
          from: from as never,
          to: to as never,
        }),
      /Invalid execution status transition|terminal/i,
    );
  }
});

test("terminal states are recognized", () => {
  assert.equal(isTerminalAgentExecutionStatus("COMPLETED"), true);
  assert.equal(isTerminalAgentExecutionStatus("FAILED"), true);
  assert.equal(isTerminalAgentExecutionStatus("RECOMMENDED_SKIP"), true);
  assert.equal(isTerminalAgentExecutionStatus("RUNNING"), false);
});

test("allowed transition list matches the validator", () => {
  assert.deepEqual(getAllowedAgentExecutionTransitions("CREATED"), [
    "RUNNING",
    "FAILED",
  ]);
  assert.deepEqual(getAllowedAgentExecutionTransitions("RECOMMENDED_SKIP"), []);
});
