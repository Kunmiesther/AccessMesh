import { InputError } from "@/lib/validation";
import { type AgentBudgetPolicy } from "./types";
import {
  AGENT_POLICY_TEMPLATES,
  type AgentExecutionPolicySnapshot,
  type AgentPolicyDetail,
  type AgentPolicyInput,
  type AgentPolicyRunOverrides,
  type AgentPolicySummary,
} from "./AgentPolicyTypes";
import {
  validateAgentPolicyCreateInput,
  validateAgentPolicyDefaultEligibility,
  validateAgentPolicyUpdateInput,
  validateAgentPolicyRunOverrides,
  validateAgentPolicyUsability,
} from "./AgentPolicyValidation";
import {
  toAgentExecutionPolicySnapshot,
  toAgentPolicyDetail,
  toAgentPolicySummary,
} from "./AgentPolicyViews";

const DEFAULT_AGENT_NAME = "AccessMesh Research Agent";
type PrismaLikeRecord = Record<string, unknown>;

export class AgentPolicyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentPolicyConflictError";
  }
}

export type AgentPolicyRepositoryClient = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { walletAddress: true };
    }): Promise<{ walletAddress: string } | null>;
  };
  agent: {
    findFirst(args: {
      where: { ownerWallet: string; name: string };
      select?: {
        id?: true;
        ownerWallet?: true;
        name?: true;
        status?: true;
        defaultPolicyId?: true;
        createdAt?: true;
        updatedAt?: true;
      };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<PrismaLikeRecord | null>;
    create(args: {
      data: {
        ownerWallet: string;
        name: string;
        status: string;
      };
      select?: {
        id?: true;
        ownerWallet?: true;
        name?: true;
        status?: true;
        defaultPolicyId?: true;
        createdAt?: true;
        updatedAt?: true;
      };
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select?: {
        id?: true;
        ownerWallet?: true;
        name?: true;
        status?: true;
        defaultPolicyId?: true;
        createdAt?: true;
        updatedAt?: true;
      };
    }): Promise<PrismaLikeRecord>;
  };
  agentPolicy: {
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt?: "asc" | "desc" } | { updatedAt?: "asc" | "desc" } | { version?: "asc" | "desc" } | { name?: "asc" | "desc" }>;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
    findUnique(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
  };
  $transaction?<T>(fn: (tx: AgentPolicyRepositoryClient) => Promise<T>): Promise<T>;
};

const POLICY_SELECT = {
  id: true,
  agentId: true,
  name: true,
  description: true,
  status: true,
  version: true,
  dailyBudgetUSDC: true,
  remainingBudgetUSDC: true,
  maxPurchaseUSDC: true,
  minimumScore: true,
  manualApprovalRequired: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} satisfies Record<string, boolean>;

type PolicyRow = {
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
  expiresAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  archivedAt: Date | string | null;
};

type AgentRow = {
  id: string;
  ownerWallet: string;
  name: string;
  status: string;
  defaultPolicyId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ResolvedAgentPolicy = Readonly<{
  agentId: string;
  policy: AgentPolicyDetail;
  runtimePolicy: AgentBudgetPolicy;
  snapshot: AgentExecutionPolicySnapshot;
  overridesApplied: string[];
}>;

export class AgentPolicyRepository {
  constructor(private readonly clientFactory?: () => Promise<AgentPolicyRepositoryClient>) {}

  async getOrCreateDefaultAgent(ownerId: string): Promise<AgentRow> {
    const client = await this.getClient();
    return this.withTransaction(client, (tx) => this.resolveDefaultAgent(tx, ownerId));
  }

  async listPoliciesForOwner(ownerId: string): Promise<AgentPolicySummary[]> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const policies = await this.getPoliciesForAgent(tx, agent.id);
      const defaultPolicyId = await this.ensureDefaultPolicyAssignment(tx, agent, policies);

      return sortPolicyViews(
        policies.map((policy) => toAgentPolicySummary(policy, policy.id === defaultPolicyId)),
      );
    });
  }

  async getPolicyForOwner(
    ownerId: string,
    policyId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const policy = await this.findPolicyById(tx, policyId);
      if (!policy || policy.agentId !== agent.id) {
        return null;
      }

      const defaultPolicyId = await this.ensureDefaultPolicyAssignment(tx, agent, [policy]);
      return toAgentPolicyDetail(policy, policy.id === defaultPolicyId);
    });
  }

  async createPolicy(
    ownerId: string,
    input: AgentPolicyInput,
  ): Promise<AgentPolicyDetail> {
    const validation = validateAgentPolicyCreateInput(input);
    if (!validation.ok) {
      throw new InputError(flattenValidationErrors(validation.errors));
    }

    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const existingPolicies = await this.getPoliciesForAgent(tx, agent.id);
      const defaultPolicyId = await this.ensureDefaultPolicyAssignment(tx, agent, existingPolicies);

      if (existingPolicies.some((policy) => policy.name === validation.value.name)) {
        throw new AgentPolicyConflictError("policy name already exists");
      }

      const policy = await tx.agentPolicy.create({
        data: {
          agentId: agent.id,
          name: validation.value.name,
          description: validation.value.description,
          status: "ACTIVE",
          version: 1,
          dailyBudgetUSDC: validation.value.dailyBudgetUSDC,
          remainingBudgetUSDC: validation.value.remainingBudgetUSDC,
          maxPurchaseUSDC: validation.value.maxPurchaseUSDC,
          minimumScore: validation.value.minimumScore,
          manualApprovalRequired: validation.value.manualApprovalRequired,
          expiresAt: validation.value.expiresAt ? new Date(validation.value.expiresAt) : null,
          archivedAt: null,
        },
        select: POLICY_SELECT,
      });

      const createdPolicy = policy as PolicyRow;
      const shouldBecomeDefault =
        existingPolicies.filter((item) => item.status === "ACTIVE" && !item.archivedAt).length === 0 &&
        defaultPolicyId === null;

      if (shouldBecomeDefault) {
        await this.setAgentDefaultPolicy(tx, agent.id, createdPolicy.id);
      }

      return toAgentPolicyDetail(createdPolicy, shouldBecomeDefault);
    });
  }

  async updatePolicy(
    ownerId: string,
    policyId: string,
    input: AgentPolicyInput & { expectedVersion: number },
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const current = await this.findPolicyById(tx, policyId);
      if (!current || current.agentId !== agent.id) {
        return null;
      }

      const policyView = toAgentPolicySummary(current, agent.defaultPolicyId === current.id);
      if (!validateAgentPolicyUsability(policyView).ok) {
        throw new AgentPolicyConflictError("archived policy must be restored before editing");
      }

      const validation = validateAgentPolicyUpdateInput(input, policyView);
      if (!validation.ok) {
        throw new InputError(flattenValidationErrors(validation.errors));
      }

      if (validation.value.expectedVersion !== current.version) {
        throw new AgentPolicyConflictError("policy was modified by another request");
      }

      const nextName = validation.value.name ?? current.name;
      if (
        nextName !== current.name &&
        (await this.getPoliciesForAgent(tx, agent.id)).some(
          (policy) => policy.id !== current.id && policy.name === nextName,
        )
      ) {
        throw new AgentPolicyConflictError("policy name already exists");
      }

      const nextVersion = current.version + 1;
      const updated = await tx.agentPolicy.update({
        where: { id: current.id },
        data: {
          ...(validation.value.name !== undefined ? { name: validation.value.name } : {}),
          ...(validation.value.description !== undefined ? { description: validation.value.description } : {}),
          ...(validation.value.dailyBudgetUSDC !== undefined
            ? { dailyBudgetUSDC: validation.value.dailyBudgetUSDC }
            : {}),
          ...(validation.value.remainingBudgetUSDC !== undefined
            ? { remainingBudgetUSDC: validation.value.remainingBudgetUSDC }
            : {}),
          ...(validation.value.maxPurchaseUSDC !== undefined
            ? { maxPurchaseUSDC: validation.value.maxPurchaseUSDC }
            : {}),
          ...(validation.value.minimumScore !== undefined
            ? { minimumScore: validation.value.minimumScore }
            : {}),
          ...(validation.value.expiresAt !== undefined
            ? { expiresAt: validation.value.expiresAt ? new Date(validation.value.expiresAt) : null }
            : {}),
          ...(validation.value.manualApprovalRequired ? { manualApprovalRequired: true } : {}),
          version: nextVersion,
          updatedAt: new Date(),
        },
        select: POLICY_SELECT,
      });

      return toAgentPolicyDetail(updated as PolicyRow, agent.defaultPolicyId === current.id);
    });
  }

  async duplicatePolicy(
    ownerId: string,
    policyId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const current = await this.findPolicyById(tx, policyId);
      if (!current || current.agentId !== agent.id) {
        return null;
      }

      const policyView = toAgentPolicySummary(current, agent.defaultPolicyId === current.id);
      const validation = validateAgentPolicyUsability(policyView);
      if (!validation.ok) {
        throw new AgentPolicyConflictError("archived policies cannot be duplicated for new runs");
      }

      const policies = await this.getPoliciesForAgent(tx, agent.id);
      const duplicateName = buildDuplicatePolicyName(current.name, policies.map((policy) => policy.name));
      const duplicate = await tx.agentPolicy.create({
        data: {
          agentId: agent.id,
          name: duplicateName,
          description: current.description,
          status: "ACTIVE",
          version: 1,
          dailyBudgetUSDC: current.dailyBudgetUSDC,
          remainingBudgetUSDC: current.dailyBudgetUSDC,
          maxPurchaseUSDC: current.maxPurchaseUSDC,
          minimumScore: current.minimumScore,
          manualApprovalRequired: true,
          expiresAt: current.expiresAt ? new Date(current.expiresAt) : null,
          archivedAt: null,
        },
        select: POLICY_SELECT,
      });

      return toAgentPolicyDetail(duplicate as PolicyRow, false);
    });
  }

  async archivePolicy(
    ownerId: string,
    policyId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const current = await this.findPolicyById(tx, policyId);
      if (!current || current.agentId !== agent.id) {
        return null;
      }

      if (agent.defaultPolicyId === current.id) {
        throw new AgentPolicyConflictError("select another default policy before archiving this one");
      }

      if (current.status === "ARCHIVED" || current.archivedAt) {
        return toAgentPolicyDetail(current as PolicyRow, false);
      }

      const archived = await tx.agentPolicy.update({
        where: { id: current.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedAt: new Date(),
        },
        select: POLICY_SELECT,
      });

      return toAgentPolicyDetail(archived as PolicyRow, false);
    });
  }

  async restorePolicy(
    ownerId: string,
    policyId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const current = await this.findPolicyById(tx, policyId);
      if (!current || current.agentId !== agent.id) {
        return null;
      }

      if (current.status === "ACTIVE" && !current.archivedAt) {
        return toAgentPolicyDetail(current as PolicyRow, agent.defaultPolicyId === current.id);
      }

      const restored = await tx.agentPolicy.update({
        where: { id: current.id },
        data: {
          status: "ACTIVE",
          archivedAt: null,
          updatedAt: new Date(),
        },
        select: POLICY_SELECT,
      });

      return toAgentPolicyDetail(restored as PolicyRow, agent.defaultPolicyId === current.id);
    });
  }

  async setDefaultPolicy(
    ownerId: string,
    policyId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const current = await this.findPolicyById(tx, policyId);
      if (!current || current.agentId !== agent.id) {
        return null;
      }

      const policyView = toAgentPolicySummary(current, agent.defaultPolicyId === current.id);
      const eligibility = validateAgentPolicyDefaultEligibility(policyView);
      if (!eligibility.ok) {
        throw new AgentPolicyConflictError("archived policies cannot be made default");
      }

      if (agent.defaultPolicyId !== current.id) {
        await this.setAgentDefaultPolicy(tx, agent.id, current.id);
      }

      return toAgentPolicyDetail(current as PolicyRow, true);
    });
  }

  async getDefaultPolicyForOwner(
    ownerId: string,
  ): Promise<AgentPolicyDetail | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, ownerId);
      const policies = await this.getPoliciesForAgent(tx, agent.id);
      if (policies.length === 0) {
        const created = await this.createSeedPolicy(tx, agent.id);
        await this.setAgentDefaultPolicy(tx, agent.id, created.id);
        return toAgentPolicyDetail(created, true);
      }

      const agentDefault = agent.defaultPolicyId
        ? policies.find((policy) => policy.id === agent.defaultPolicyId)
        : null;

      if (agentDefault && agentDefault.status === "ACTIVE" && !agentDefault.archivedAt) {
        return toAgentPolicyDetail(agentDefault, true);
      }

      const activePolicy = policies.find(
        (policy) => policy.status === "ACTIVE" && !policy.archivedAt,
      );
      if (activePolicy) {
        await this.setAgentDefaultPolicy(tx, agent.id, activePolicy.id);
        return toAgentPolicyDetail(activePolicy, true);
      }

      const created = await this.createSeedPolicy(tx, agent.id);
      await this.setAgentDefaultPolicy(tx, agent.id, created.id);
      return toAgentPolicyDetail(created, true);
    });
  }

  async resolvePolicyForExecution(params: {
    ownerId: string;
    policyId?: string | null;
    overrides?: AgentPolicyRunOverrides | null;
  }): Promise<ResolvedAgentPolicy | null> {
    const client = await this.getClient();
    return this.withTransaction(client, async (tx) => {
      const agent = await this.resolveDefaultAgent(tx, params.ownerId);
      const selectedPolicy = params.policyId
        ? await this.findPolicyById(tx, params.policyId)
        : null;

      let policy: PolicyRow | null = null;
      let isDefault = false;

      if (selectedPolicy) {
        if (selectedPolicy.agentId !== agent.id) {
          return null;
        }

        policy = selectedPolicy;
      } else {
        const defaultPolicy = await this.getOrCreateDefaultPolicyRow(tx, agent);
        if (!defaultPolicy) {
          return null;
        }

        policy = defaultPolicy;
        isDefault = true;
      }

      if (!policy) {
        return null;
      }

      const policyView = toAgentPolicyDetail(policy, isDefault || agent.defaultPolicyId === policy.id);
      const usability = validateAgentPolicyUsability(policyView);
      if (!usability.ok) {
        throw new AgentPolicyConflictError("archived policies cannot be used for new runs");
      }

      const overrideValidation = validateAgentPolicyRunOverrides(
        params.overrides ?? {},
        policyView,
      );
      if (!overrideValidation.ok) {
        throw new InputError(flattenValidationErrors(overrideValidation.errors));
      }

      const runtimePolicy = applyPolicyOverridesToRuntime(policyView, overrideValidation.value);
      const overridesApplied = Object.keys(overrideValidation.value);

      return {
        agentId: agent.id,
        policy: policyView,
        runtimePolicy,
        snapshot: toAgentExecutionPolicySnapshot(
          policyView,
          overridesApplied,
          overrideValidation.value,
        ),
        overridesApplied,
      };
    });
  }

  private async createSeedPolicy(
    client: AgentPolicyRepositoryClient,
    agentId: string,
  ) {
    const template = AGENT_POLICY_TEMPLATES["balanced-buyer"];
    const existingPolicies = await this.getPoliciesForAgent(client, agentId);
    const name = buildUniquePolicyName(template.name, existingPolicies.map((policy) => policy.name));

    return client.agentPolicy.create({
      data: {
        agentId,
        name,
        description: template.description,
        status: "ACTIVE",
        version: 1,
        dailyBudgetUSDC: Number(template.dailyBudgetUSDC),
        remainingBudgetUSDC: Number(template.remainingBudgetUSDC),
        maxPurchaseUSDC: Number(template.maxPurchaseUSDC),
        minimumScore: template.minimumScore,
        manualApprovalRequired: template.manualApprovalRequired,
        expiresAt: null,
        archivedAt: null,
      },
      select: POLICY_SELECT,
    }) as Promise<PolicyRow>;
  }

  private async resolveDefaultAgent(
    client: AgentPolicyRepositoryClient,
    ownerId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: ownerId },
      select: { walletAddress: true },
    });

    if (!user) {
      throw new InputError("owner not found");
    }

    const existing = await client.agent.findFirst({
      where: {
        ownerWallet: user.walletAddress,
        name: DEFAULT_AGENT_NAME,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ownerWallet: true,
        name: true,
        status: true,
        defaultPolicyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) {
      return existing as AgentRow;
    }

    const created = await client.agent.create({
      data: {
        ownerWallet: user.walletAddress,
        name: DEFAULT_AGENT_NAME,
        status: "ACTIVE",
      },
      select: {
        id: true,
        ownerWallet: true,
        name: true,
        status: true,
        defaultPolicyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return created as AgentRow;
  }

  private async getPoliciesForAgent(
    client: AgentPolicyRepositoryClient,
    agentId: string,
  ) {
    return (await client.agentPolicy.findMany({
      where: { agentId },
      orderBy: [
        { createdAt: "asc" },
        { updatedAt: "asc" },
        { version: "asc" },
        { name: "asc" },
      ],
      select: POLICY_SELECT,
    })) as PolicyRow[];
  }

  private async findPolicyById(
    client: AgentPolicyRepositoryClient,
    policyId: string,
  ) {
    return (await client.agentPolicy.findUnique({
      where: { id: policyId },
      select: POLICY_SELECT,
    })) as PolicyRow | null;
  }

  private async setAgentDefaultPolicy(
    client: AgentPolicyRepositoryClient,
    agentId: string,
    policyId: string,
  ) {
    await client.agent.update({
      where: { id: agentId },
      data: { defaultPolicyId: policyId, updatedAt: new Date() },
      select: {
        id: true,
        ownerWallet: true,
        name: true,
        status: true,
        defaultPolicyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private async ensureDefaultPolicyAssignment(
    client: AgentPolicyRepositoryClient,
    agent: AgentRow,
    policies: PolicyRow[],
  ) {
    if (agent.defaultPolicyId) {
      const existingDefault = policies.find((policy) => policy.id === agent.defaultPolicyId);
      if (existingDefault && existingDefault.status === "ACTIVE" && !existingDefault.archivedAt) {
        return existingDefault.id;
      }
    }

    const activePolicy = policies.find((policy) => policy.status === "ACTIVE" && !policy.archivedAt);
    if (activePolicy) {
      if (agent.defaultPolicyId !== activePolicy.id) {
        await this.setAgentDefaultPolicy(client, agent.id, activePolicy.id);
      }

      return activePolicy.id;
    }

    return null;
  }

  private async getOrCreateDefaultPolicyRow(
    client: AgentPolicyRepositoryClient,
    agent: AgentRow,
  ) {
    const policies = await this.getPoliciesForAgent(client, agent.id);
    const defaultPolicyId = await this.ensureDefaultPolicyAssignment(client, agent, policies);
    if (defaultPolicyId) {
      return policies.find((policy) => policy.id === defaultPolicyId) ?? null;
    }

    if (policies.length > 0) {
      return policies.find((policy) => policy.status === "ACTIVE" && !policy.archivedAt) ?? null;
    }

    const created = await this.createSeedPolicy(client, agent.id);
    await this.setAgentDefaultPolicy(client, agent.id, created.id);
    return created as PolicyRow;
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentPolicyRepositoryClient;
  }

  private async withTransaction<T>(
    client: AgentPolicyRepositoryClient,
    callback: (tx: AgentPolicyRepositoryClient) => Promise<T>,
  ) {
    if (client.$transaction) {
      return client.$transaction((tx) => callback(tx));
    }

    return callback(client);
  }
}

function applyPolicyOverridesToRuntime(
  policy: AgentPolicySummary | AgentPolicyDetail,
  overrides: AgentPolicyRunOverrides,
): AgentBudgetPolicy {
  return {
    remainingBudgetUSDC: normalizePolicyNumber(
      overrides.remainingBudgetUSDC,
      Number(policy.remainingBudgetUSDC),
    ),
    maxPurchaseUSDC: normalizePolicyNumber(
      overrides.maxPurchaseUSDC,
      Number(policy.maxPurchaseUSDC),
    ),
    minimumMatchScore: normalizePolicyNumber(
      overrides.minimumScore,
      Number(policy.minimumScore),
    ),
  };
}

function sortPolicyViews(policies: AgentPolicySummary[]) {
  return [...policies].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    if (left.status !== right.status) {
      return left.status === "ACTIVE" ? -1 : 1;
    }

    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt < right.updatedAt ? 1 : -1;
    }

    return left.name.localeCompare(right.name);
  });
}

function buildDuplicatePolicyName(baseName: string, names: string[]) {
  const trimmed = baseName.trim().replace(/\s+Copy(?:\s+\d+)?$/i, "");
  return buildUniquePolicyName(`${trimmed} Copy`, names);
}

function buildUniquePolicyName(baseName: string, names: string[]) {
  if (!names.includes(baseName)) {
    return baseName;
  }

  let index = 2;
  while (names.includes(`${baseName} ${index}`)) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

function flattenValidationErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("; ");
}

function normalizePolicyNumber(
  overrideValue: string | number | null | undefined,
  fallbackValue: number,
) {
  if (typeof overrideValue === "number" && Number.isFinite(overrideValue)) {
    return overrideValue;
  }

  if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
    const parsed = Number(overrideValue.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallbackValue;
}
