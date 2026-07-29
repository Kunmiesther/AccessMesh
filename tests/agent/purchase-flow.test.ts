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
  const sequence: string[] = [];
  let submitted = 0;
  let confirmed = 0;
  let unlocked = 0;
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);

    if (url.includes("/api/agent/executions/execution-1/payment-submitted")) {
      return new Response(JSON.stringify({ ok: true, execution: { id: "execution-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/api/agent/executions/execution-1/settlement-verification")) {
      return new Response(JSON.stringify({ ok: true, execution: { id: "execution-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/api/access/unlock")) {
      return new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const outcome = await executeAgentPurchaseFlow({
      result,
      policy,
      walletAddress,
      bundlerClient: { account: { address: walletAddress } } as never,
      accessIntent: accessIntent as never,
      executionId: "execution-1",
      onStage: ({ phase }) => {
        stages.push(phase);
      },
      preparePayment: async () => {
        sequence.push("prepare");
      },
      submitPayment: async () => {
        sequence.push("submit");
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
        sequence.push("unlock");
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
    assert.deepEqual(sequence, ["prepare", "submit", "unlock"]);
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
    assert.ok(calls.some((call) => call.includes("/api/agent/executions/execution-1/payment-submitted")));
    assert.ok(calls.some((call) => call.includes("/api/agent/executions/execution-1/settlement-verification")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("purchase flow carries the executionId through trusted lifecycle writes", async () => {
  const calls: Array<{
    url: string;
    body: unknown;
  }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, body });

    if (url.includes("/api/agent/executions/execution-1/payment-submitted")) {
      return new Response(JSON.stringify({ ok: true, execution: { id: "execution-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/api/agent/executions/execution-1/settlement-verification")) {
      return new Response(JSON.stringify({ ok: true, execution: { id: "execution-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/api/access/unlock")) {
      return new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const outcome = await executeAgentPurchaseFlow({
      result,
      policy,
      walletAddress,
      bundlerClient: { account: { address: walletAddress } } as never,
      accessIntent: accessIntent as never,
      executionId: "execution-1",
      submitPayment: async () => "0xaaaa" as never,
      confirmPayment: async () => ({
        status: "confirmed",
        userOpHash: "0xaaaa",
        transactionHash: "0xbbbb",
      }) as never,
    });

    assert.equal(outcome.ok, true);
    assert.ok(calls.some((call) => call.url.includes("/api/agent/executions/execution-1/payment-submitted")));
    assert.ok(calls.some((call) => call.url.includes("/api/agent/executions/execution-1/settlement-verification")));

    const unlockCall = calls.find((call) => call.url.includes("/api/access/unlock"));
    assert.ok(unlockCall);
    assert.equal((unlockCall?.body as { executionId?: string | null } | null)?.executionId, "execution-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed payment preparation releases the reservation before failure handling", async () => {
  const calls: string[] = [];

  const outcome = await executeAgentPurchaseFlow({
    result,
    policy,
    walletAddress,
    bundlerClient: { account: { address: walletAddress } } as never,
    accessIntent: accessIntent as never,
    executionId: "execution-1",
    preparePayment: async () => {
      calls.push("prepare");
      throw new Error("budget reservation could not be created");
    },
    cancelPaymentPreparation: async () => {
      calls.push("cancel");
    },
    submitPayment: async () => {
      calls.push("submit");
      return "0xaaaa" as never;
    },
  });

  assert.equal(outcome.ok, false);
  assert.deepEqual(calls, ["prepare", "cancel"]);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "UNKNOWN");
  }
});

test("payment rejection does not reach unlock success", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const outcome = await executeAgentPurchaseFlow({
      result,
      policy,
      walletAddress,
      bundlerClient: { account: { address: walletAddress } } as never,
      accessIntent: accessIntent as never,
      executionId: "execution-1",
      submitPayment: async () => {
        throw new Error("wallet approval rejected");
      },
    });

    assert.equal(outcome.ok, false);
    assert.ok(calls.some((url) => url.includes("/api/agent/executions/execution-1/cancel-approval")));
    assert.equal(
      calls.some((url) => url.includes("/api/agent/executions/execution-1/payment-submitted")),
      false,
    );
    assert.equal(calls.some((url) => url.includes("/api/access/unlock")), false);
    if (!outcome.ok) {
      assert.equal(outcome.reason, "APPROVAL_REJECTED");
    }
  } finally {
    globalThis.fetch = originalFetch;
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
