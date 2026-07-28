import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getPolicies, POST as createPolicy } from "../../app/api/agent/policies/route";
import { handleAgentRunRequest } from "../../app/api/agent/run/route";
import { AgentPoliciesHeader } from "../../components/agent/policies/AgentPoliciesHeader";
import { AgentPolicyDefaultBadge } from "../../components/agent/policies/AgentPolicyDefaultBadge";
import { AgentPolicyEmptyState } from "../../components/agent/policies/AgentPolicyEmptyState";
import { AgentPolicyStatusBadge } from "../../components/agent/policies/AgentPolicyStatusBadge";
import { AgentPolicyTemplatePicker } from "../../components/agent/policies/AgentPolicyTemplatePicker";
import {
  AGENT_POLICY_TEMPLATES,
  type AgentPolicyDetail,
} from "../../services/agent/AgentPolicyTypes";
import {
  validateAgentPolicyCreateInput,
  validateAgentPolicyRunOverrides,
  validateAgentPolicyUpdateInput,
} from "../../services/agent/AgentPolicyValidation";
import { AgentPolicyRepository } from "../../services/agent/AgentPolicyRepository";
import {
  createAgentOwnerSessionPayload,
  encodeAgentOwnerSession,
} from "../../lib/auth/agentOwnerSession";

const owner = {
  ownerId: "owner-1",
  walletAddress: "0x1111111111111111111111111111111111111111",
  username: "accessmesh",
  authenticationMethod: "CIRCLE_SESSION" as const,
};

test("policy validation accepts a safe create input", () => {
  const result = validateAgentPolicyCreateInput({
    name: "Balanced Buyer",
    description: "Reusable policy",
    dailyBudgetUSDC: "20",
    remainingBudgetUSDC: "20",
    maxPurchaseUSDC: "4",
    minimumScore: "70",
    expiresAt: null,
    manualApprovalRequired: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.name, "Balanced Buyer");
    assert.equal(result.value.manualApprovalRequired, true);
  }
});

test("policy validation rejects unknown fields and disabled manual approval", () => {
  const result = validateAgentPolicyCreateInput({
    name: "Balanced Buyer",
    description: "Reusable policy",
    dailyBudgetUSDC: "20",
    remainingBudgetUSDC: "20",
    maxPurchaseUSDC: "4",
    minimumScore: "70",
    manualApprovalRequired: false,
    ownerId: "spoofed",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.root ?? "", /unknown field/i);
  assert.match(result.errors.manualApprovalRequired ?? "", /manual approval/i);
});

test("restrictive run overrides are accepted and permissive ones are rejected", () => {
  const safe = validateAgentPolicyRunOverrides(
    {
      remainingBudgetUSDC: "10",
      maxPurchaseUSDC: "2",
      minimumScore: "80",
    },
    {
      dailyBudgetUSDC: "20",
      remainingBudgetUSDC: "20",
      maxPurchaseUSDC: "4",
      minimumScore: 70,
    },
  );

  assert.equal(safe.ok, true);

  const unsafe = validateAgentPolicyRunOverrides(
    {
      remainingBudgetUSDC: "30",
      maxPurchaseUSDC: "5",
      minimumScore: "60",
    },
    {
      dailyBudgetUSDC: "20",
      remainingBudgetUSDC: "20",
      maxPurchaseUSDC: "4",
      minimumScore: 70,
    },
  );

  assert.equal(unsafe.ok, false);
  assert.match(unsafe.errors.remainingBudgetUSDC ?? "", /can only reduce/i);
  assert.match(unsafe.errors.maxPurchaseUSDC ?? "", /can only reduce/i);
  assert.match(unsafe.errors.minimumScore ?? "", /more restrictive/i);
});

test("policy updates require the expected version", () => {
  const result = validateAgentPolicyUpdateInput(
    {
      expectedVersion: 2,
      name: "Balanced Buyer v2",
      manualApprovalRequired: true,
    },
    {
      id: "policy-1",
      name: "Balanced Buyer",
      description: null,
      status: "ACTIVE",
      isDefault: true,
      version: 1,
      dailyBudgetUSDC: "20",
      remainingBudgetUSDC: "20",
      maxPurchaseUSDC: "4",
      minimumScore: 70,
      manualApprovalRequired: true,
      expiresAt: null,
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
      archivedAt: null,
    },
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.expectedVersion, 2);
    assert.equal(result.value.name, "Balanced Buyer v2");
  }
});

test("default agent is reused and default policy is created safely", async () => {
  const state = createPolicyState();
  state.users.set(owner.ownerId, { walletAddress: owner.walletAddress });
  state.agents.push({
    id: "agent-1",
    ownerWallet: owner.walletAddress,
    name: "AccessMesh Research Agent",
    status: "ACTIVE",
    defaultPolicyId: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const repository = new AgentPolicyRepository(
    () => Promise.resolve(createPolicyClient(state) as never),
  );
  const agent = await repository.getOrCreateDefaultAgent(owner.ownerId);

  assert.equal(agent.id, "agent-1");

  const policy = await repository.createPolicy(owner.ownerId, {
    name: "Balanced Buyer",
    description: "Reusable policy",
    dailyBudgetUSDC: "20",
    remainingBudgetUSDC: "20",
    maxPurchaseUSDC: "4",
    minimumScore: "70",
    expiresAt: null,
    manualApprovalRequired: true,
  });

  assert.equal(policy.isDefault, true);
  assert.equal(state.agents[0]?.defaultPolicyId, policy.id);
});

test("duplicating a policy resets its version and remaining budget", async () => {
  const state = createPolicyState();
  state.users.set(owner.ownerId, { walletAddress: owner.walletAddress });
  const agent = createAgent(state, owner.walletAddress);
  const existing = createPolicyRow({
    id: "policy-1",
    agentId: agent.id,
    name: "Balanced Buyer",
    description: "Reusable policy",
    status: "ACTIVE",
    version: 3,
    dailyBudgetUSDC: 20,
    remainingBudgetUSDC: 8,
    maxPurchaseUSDC: 4,
    minimumScore: 70,
    manualApprovalRequired: true,
    expiresAt: null,
    archivedAt: null,
  });
  state.policies.push(existing);

  const repository = new AgentPolicyRepository(
    () => Promise.resolve(createPolicyClient(state) as never),
  );
  const duplicate = await repository.duplicatePolicy(owner.ownerId, existing.id);

  assert.equal(duplicate?.version, 1);
  assert.equal(duplicate?.remainingBudgetUSDC, "20");
  assert.match(duplicate?.name ?? "", /Copy/);
});

test("archive refuses the active default policy", async () => {
  const state = createPolicyState();
  state.users.set(owner.ownerId, { walletAddress: owner.walletAddress });
  const agent = createAgent(state, owner.walletAddress, "policy-1");
  const defaultPolicy = createPolicyRow({
    id: "policy-1",
    agentId: agent.id,
    name: "Balanced Buyer",
    description: null,
    status: "ACTIVE",
    version: 1,
    dailyBudgetUSDC: 20,
    remainingBudgetUSDC: 20,
    maxPurchaseUSDC: 4,
    minimumScore: 70,
    manualApprovalRequired: true,
    expiresAt: null,
    archivedAt: null,
  });
  state.policies.push(defaultPolicy);

  const repository = new AgentPolicyRepository(
    () => Promise.resolve(createPolicyClient(state) as never),
  );
  await assert.rejects(
    () => repository.archivePolicy(owner.ownerId, defaultPolicy.id),
    /select another default policy/i,
  );
});

test("GET /api/agent/policies returns owner-scoped policies", async () => {
  const original = AgentPolicyRepository.prototype.listPoliciesForOwner;
  AgentPolicyRepository.prototype.listPoliciesForOwner = async () => [
    {
      id: "policy-1",
      name: "Balanced Buyer",
      description: "Reusable policy",
      status: "ACTIVE",
      isDefault: true,
      version: 1,
      dailyBudgetUSDC: "20",
      remainingBudgetUSDC: "20",
      maxPurchaseUSDC: "4",
      minimumScore: 70,
      manualApprovalRequired: true,
      expiresAt: null,
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
      archivedAt: null,
    },
  ] as never;

  try {
    const cookie = encodeAgentOwnerSession(createAgentOwnerSessionPayload(owner));
    const response = await getPolicies(
      new Request("http://localhost/api/agent/policies", {
        headers: { cookie: `accessmesh_agent_owner_session=${cookie}` },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const payload = await response.json();
    assert.equal(payload.policies[0].name, "Balanced Buyer");
    assert.equal(payload.defaultPolicyId, "policy-1");
  } finally {
    AgentPolicyRepository.prototype.listPoliciesForOwner = original;
  }
});

test("POST /api/agent/run persists the selected policy summary", async () => {
  const originalResolve = AgentPolicyRepository.prototype.resolvePolicyForExecution;
  AgentPolicyRepository.prototype.resolvePolicyForExecution = async () =>
    ({
      agentId: "agent-1",
      policy: {
        id: "policy-1",
        name: "Balanced Buyer",
        description: "Reusable policy",
        status: "ACTIVE",
        isDefault: true,
        version: 3,
        dailyBudgetUSDC: "20",
        remainingBudgetUSDC: "10",
        maxPurchaseUSDC: "4",
        minimumScore: 70,
        manualApprovalRequired: true,
        expiresAt: null,
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
        archivedAt: null,
      },
      runtimePolicy: {
        remainingBudgetUSDC: 10,
        maxPurchaseUSDC: 4,
        minimumMatchScore: 80,
      },
      snapshot: {
        policyId: "policy-1",
        policyName: "Balanced Buyer",
        policyStatus: "ACTIVE",
        policyVersion: 3,
        policyDescription: "Reusable policy",
        isDefault: true,
        dailyBudgetUSDC: 20,
        remainingBudgetUSDC: 10,
        maxPurchaseUSDC: 4,
        minimumScore: 70,
        manualApprovalRequired: true,
        expiresAt: null,
        overridesApplied: ["minimumScore"],
        overrides: {
          minimumScore: 80,
        },
      },
      overridesApplied: ["minimumScore"],
    }) as never;

  try {
    const response = await handleAgentRunRequest(
      new Request("http://localhost/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: "Find the best Circle CCTP guide under 0.20 USDC",
          selectedPolicyId: "policy-1",
          policyOverrides: { minimumScore: 80 },
          resourceLimit: 50,
        }),
      }),
      async (input) => ({
        executionId: "execution-1",
        goal: {
          originalGoal: input.goal,
          normalizedQuery: "circle cctp guide",
          keywords: ["circle", "cctp", "guide"],
          maximumPriceUSDC: 0.2,
        },
        decision: "SKIP",
        selectedResource: null,
        selectedEvaluation: null,
        candidates: [],
        trace: [
          {
            step: "decision",
            status: "SKIPPED",
            message: "No purchase was recommended.",
          },
        ],
      }),
      () => owner,
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.executionId, "execution-1");
    assert.equal(payload.policy.id, "policy-1");
    assert.deepEqual(payload.policy.overridesApplied, ["minimumScore"]);
  } finally {
    AgentPolicyRepository.prototype.resolvePolicyForExecution = originalResolve;
  }
});

test("policy UI renders safe templates and badges", () => {
  const markup = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(AgentPoliciesHeader),
      createElement(AgentPolicyDefaultBadge),
      createElement(AgentPolicyStatusBadge, { status: "ACTIVE" }),
      createElement(AgentPolicyEmptyState),
      createElement(AgentPolicyTemplatePicker),
    ),
  );

  assert.equal(markup.includes("Agent Policies"), true);
  assert.equal(markup.includes("No saved policies yet"), true);
  assert.equal(markup.includes("Balanced Buyer"), true);
  assert.equal(markup.includes("Use template"), true);
});

function now() {
  return "2026-07-28T00:00:00.000Z";
}

function createPolicyState() {
  return {
    users: new Map<string, { walletAddress: string }>(),
    agents: [] as Array<{
      id: string;
      ownerWallet: string;
      name: string;
      status: string;
      defaultPolicyId: string | null;
      createdAt: string;
      updatedAt: string;
    }>,
    policies: [] as Array<ReturnType<typeof createPolicyRow>>,
  };
}

function createAgent(state: ReturnType<typeof createPolicyState>, ownerWallet: string, defaultPolicyId: string | null = null) {
  const agent = {
    id: `agent-${state.agents.length + 1}`,
    ownerWallet,
    name: "AccessMesh Research Agent",
    status: "ACTIVE",
    defaultPolicyId,
    createdAt: now(),
    updatedAt: now(),
  };
  state.agents.push(agent);
  return agent;
}

function createPolicyRow(row: {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  dailyBudgetUSDC: number;
  remainingBudgetUSDC: number;
  maxPurchaseUSDC: number;
  minimumScore: number;
  manualApprovalRequired: boolean;
  expiresAt: string | null;
  archivedAt: string | null;
}) {
  return {
    ...row,
    createdAt: now(),
    updatedAt: now(),
  };
}

function createPolicyClient(state: ReturnType<typeof createPolicyState>) {
  return {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        const user = state.users.get(where.id);
        return user ? { walletAddress: user.walletAddress } : null;
      },
    },
    agent: {
      async findFirst({ where }: { where: { ownerWallet: string; name: string } }) {
        return state.agents.find(
          (agent) => agent.ownerWallet === where.ownerWallet && agent.name === where.name,
        ) ?? null;
      },
      async create({ data }: { data: { ownerWallet: string; name: string; status: string } }) {
        const agent = createAgent(state, data.ownerWallet);
        agent.name = data.name;
        agent.status = data.status;
        return agent;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const agent = state.agents.find((item) => item.id === where.id);
        if (!agent) {
          throw new Error("agent not found");
        }
        if (typeof data.defaultPolicyId === "string" || data.defaultPolicyId === null) {
          agent.defaultPolicyId = data.defaultPolicyId;
        }
        return agent;
      },
    },
    agentPolicy: {
      async findMany({ where }: { where?: { agentId?: string } }) {
        return where?.agentId
          ? state.policies.filter((policy) => policy.agentId === where.agentId)
          : [...state.policies];
      },
      async findUnique({ where }: { where: { id: string } }) {
        return state.policies.find((policy) => policy.id === where.id) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const policy = createPolicyRow({
          id: `policy-${state.policies.length + 1}`,
          agentId: String(data.agentId),
          name: String(data.name),
          description: (data.description as string | null) ?? null,
          status: String(data.status),
          version: Number(data.version ?? 1),
          dailyBudgetUSDC: Number(data.dailyBudgetUSDC),
          remainingBudgetUSDC: Number(data.remainingBudgetUSDC),
          maxPurchaseUSDC: Number(data.maxPurchaseUSDC),
          minimumScore: Number(data.minimumScore),
          manualApprovalRequired: Boolean(data.manualApprovalRequired),
          expiresAt: (data.expiresAt as string | null) ?? null,
          archivedAt: (data.archivedAt as string | null) ?? null,
        });
        state.policies.push(policy);
        return policy;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const policy = state.policies.find((item) => item.id === where.id);
        if (!policy) {
          throw new Error("policy not found");
        }
        Object.assign(policy, data);
        return policy;
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(this);
    },
  };
}
