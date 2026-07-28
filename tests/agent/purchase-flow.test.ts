import test from "node:test";
import assert from "node:assert/strict";
import { executeAgentPurchaseFlow, validateAgentPurchaseBinding } from "../../services/agent/AgentPurchaseFlow";
import type { AgentBudgetPolicy } from "../../services/agent/types";
import type { AgentRuntimeResultView } from "../../components/agent/types";

const walletAddress = "0x1111111111111111111111111111111111111111" as const;
const selectedResourceId = "resource-1";
const selectedResourceTitle = "Circle CCTP Guide";

const policy: AgentBudgetPolicy = {
  remainingBudgetUSDC: 1,
  maxPurchaseUSDC: 0.25,
  minimumMatchScore: 35,
};

const result: AgentRuntimeResultView = {
  goal: {
    originalGoal: "Find the best Circle CCTP guide under 0.20 USDC",
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
    aiCollection: "Payments",
    aiPlacement: "Featured",
    publishedAt: "2026-07-24T00:00:00.000Z",
    createdAt: "2026-07-24T00:00:00.000Z",
  },
  selectedEvaluation: {
    resource: {
      id: "resource-1",
      title: "Circle CCTP Guide",
      description: "Guide",
      priceUSDC: 0.2,
      resourceType: "CONTENT",
      aiSummary: null,
      aiTopics: ["circle", "cctp"],
      aiCategory: null,
      aiCollection: "Payments",
      aiPlacement: "Featured",
      publishedAt: "2026-07-24T00:00:00.000Z",
      createdAt: "2026-07-24T00:00:00.000Z",
    },
    matchScore: 82,
    matchedKeywords: ["circle", "cctp", "guide"],
    budgetEligible: true,
    reasons: ["Keyword \"guide\" matched title (+18)."],
  },
  candidates: [],
  trace: [],
};

const accessIntent = {
  accessId: "access-1",
  amountUSDC: 0.2,
  recipientWallet: walletAddress,
  creatorWallet: walletAddress,
  treasuryWallet: "0x2222222222222222222222222222222222222222",
  creatorAmountUSDC: 0.16,
  treasuryAmountUSDC: 0.04,
  expiresAt: "2026-07-24T01:00:00.000Z",
  payerWallet: walletAddress,
  resource: result.selectedResource,
  payment: {},
};

test("rejects a price mismatch before payment starts", async () => {
  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: {
      ...accessIntent,
      amountUSDC: 0.3,
    } as never,
  });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "PRICE_CHANGED");
    assert.match(outcome.message, /price changed/i);
  }
});

test("the binding validator rejects changed live prices", () => {
  const validation = validateAgentPurchaseBinding({
    result,
    policy,
    walletAddress,
    accessIntent: {
      ...accessIntent,
      amountUSDC: 0.3,
    } as never,
  });

  assert.ok(validation);
  assert.equal(validation?.reason, "PRICE_CHANGED");
});

test("rejects a missing wallet as an authentication failure", async () => {
  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress: null,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
  });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "AUTHENTICATION_FAILED");
  }
});

test("rejects a non-BUY recommendation", async () => {
  const outcome = await executeAgentPurchaseFlow({
    result: {
      ...result,
      decision: "SKIP",
    },
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
  });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "RECOMMENDATION_INVALID");
  }
});

test("executes the trusted payment and unlock path on success", async () => {
  const stages: string[] = [];
  let submitted = 0;
  let confirmed = 0;
  let unlocked = 0;

  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
    onStage: ({ phase }) => {
      stages.push(phase);
    },
    submitPayment: async () => {
      submitted += 1;
      return "0xaaaa" as never;
    },
    confirmPayment: async () => {
      confirmed += 1;
      return {
        status: "confirmed",
        userOpHash: "0xaaaa",
        transactionHash: "0xbbbb",
      } as never;
    },
    unlockResource: async () => {
      unlocked += 1;
      return {
        ok: true,
        access: "UNLOCKED",
        expiresAt: "2026-07-24T02:00:00.000Z",
        resourceId: selectedResourceId,
        resource: accessIntent.resource,
        txHash: "0xbbbb",
        purchase: {
          id: "purchase-1",
          resourceId: selectedResourceId,
          resourceTitle: selectedResourceTitle,
          buyerWallet: walletAddress,
          creatorWallet: walletAddress,
          amountUSDC: 0.2,
          txHash: "0xbbbb",
          creatorDisplayName: null,
          timestamp: "2026-07-24T00:00:00.000Z",
        },
        verification: {
          status: "SETTLED",
          settled: true,
          txHash: "0xbbbb",
        },
      } as never;
    },
  });

  assert.equal(outcome.ok, true);
  assert.equal(submitted, 1);
  assert.equal(confirmed, 1);
  assert.equal(unlocked, 1);
  assert.deepEqual(stages, [
    "PREPARING_PAYMENT",
    "SUBMITTING_PAYMENT",
    "VERIFYING_SETTLEMENT",
    "UNLOCKING_RESOURCE",
    "COMPLETED",
  ]);
  if (outcome.ok) {
    assert.equal(outcome.completion.resourceId, selectedResourceId);
    assert.equal(outcome.completion.resourceTitle, selectedResourceTitle);
    assert.equal(outcome.completion.unlocked, true);
    assert.match(outcome.completion.explorerUrl ?? "", /0xbbbb/i);
  }
});

test("payment rejection does not reach unlock success", async () => {
  let unlocked = 0;

  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
    submitPayment: async () => {
      throw new Error("wallet approval rejected");
    },
    unlockResource: async () => {
      unlocked += 1;
      return {
        ok: true,
      } as never;
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(unlocked, 0);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "APPROVAL_REJECTED");
  }
});

test("settlement failure does not reach unlock success", async () => {
  let unlocked = 0;

  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
    submitPayment: async () => "0xaaaa" as never,
    confirmPayment: async () => ({
      status: "confirmed",
      userOpHash: "0xaaaa",
      transactionHash: "0xbbbb",
    }) as never,
    unlockResource: async () => {
      unlocked += 1;
      return {
        ok: false,
        access: "LOCKED",
        verification: {
          status: "FAILED",
          settled: false,
          txHash: "0xbbbb",
        },
      } as never;
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(unlocked, 1);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "SETTLEMENT_VERIFICATION_FAILED");
  }
});
