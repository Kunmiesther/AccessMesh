import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { InputError } from "@/lib/validation";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import {
  AgentPolicyConflictError,
  AgentPolicyRepository,
} from "@/services/agent/AgentPolicyRepository";
import { runAgentApplication } from "@/services/agent/AgentApplicationService";
import type { AgentPolicyRunOverrides } from "@/services/agent/AgentPolicyTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAgentRunRequest(request);
}

export async function handleAgentRunRequest(
  request: Request,
  runApplication = runAgentApplication,
  getOwner = requireAgentOwner,
) {
  try {
    const owner = getOwner(request);
    const body = await parseJsonBody(request);
    const input = parseAgentRunInput(body);
    const policyRepository = new AgentPolicyRepository();
    const resolvedPolicy = await policyRepository.resolvePolicyForExecution({
      ownerId: owner.ownerId,
      policyId: input.policyId,
      overrides: input.policyOverrides,
    });

    if (!resolvedPolicy) {
      return NextResponse.json(
        {
          ok: false,
          error: "policy not found",
        },
        { status: 404 },
      );
    }

    const result = await runApplication(
      {
        goal: input.goal,
        policy: resolvedPolicy.runtimePolicy,
        policySnapshot: resolvedPolicy.snapshot,
        ...(input.resourceLimit !== undefined ? { resourceLimit: input.resourceLimit } : {}),
      },
      {
        executionRepository: new AgentExecutionRepository(),
        ownerId: owner.ownerId,
      },
    );
    const { executionId = null, ...runtimeResult } = result;

    return NextResponse.json({
      ok: true,
      executionId,
      policy: {
        id: resolvedPolicy.policy.id,
        name: resolvedPolicy.policy.name,
        version: resolvedPolicy.policy.version,
        overridesApplied: resolvedPolicy.overridesApplied,
      },
      result: runtimeResult,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof UnauthorizedAgentOwnerError) {
      return NextResponse.json(
        {
          ok: false,
          error: "authentication required",
        },
        { status: 401 },
      );
    }

    if (error instanceof AgentPolicyConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 409 },
      );
    }

    console.error(error);
    return NextResponse.json(
      {
        ok: false,
        error: "agent runtime request failed",
      },
      { status: 500 },
    );
  }
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InputError("request body must be valid JSON");
  }
}

type ParsedAgentRunInput = Readonly<{
  goal: string;
  policyId: string | null;
  policyOverrides: AgentPolicyRunOverrides | undefined;
  resourceLimit: number | undefined;
}>;

function parseAgentRunInput(body: unknown): ParsedAgentRunInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("request body must be an object");
  }

  const record = body as Record<string, unknown>;
  const goal = requireString(record.goal, "goal");
  const policyId = parseOptionalString(record.policyId ?? record.selectedPolicyId) ?? null;
  const policyOverrides = parsePolicyOverrides(
    record.policyOverrides ?? record.policy ?? null,
  );
  const resourceLimit = parseOptionalResourceLimit(
    record.resourceLimit,
  );

  return {
    goal,
    policyId,
    policyOverrides,
    resourceLimit,
  };
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function parsePolicyOverrides(value: unknown): AgentPolicyRunOverrides | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("policy overrides must be an object");
  }

  const record = value as Record<string, unknown>;
  const overrides: AgentPolicyRunOverrides = {};

  if (record.remainingBudgetUSDC !== undefined) {
    overrides.remainingBudgetUSDC = requireOptionalNumber(
      record.remainingBudgetUSDC,
      "policyOverrides.remainingBudgetUSDC",
    );
  }

  if (record.maxPurchaseUSDC !== undefined) {
    overrides.maxPurchaseUSDC = requireOptionalNumber(
      record.maxPurchaseUSDC,
      "policyOverrides.maxPurchaseUSDC",
    );
  }

  if (record.minimumScore !== undefined) {
    overrides.minimumScore = requireOptionalNumber(
      record.minimumScore,
      "policyOverrides.minimumScore",
    );
  }

  return overrides;
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError(`${field} must be a number`);
  }

  return value;
}

function requireOptionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    throw new InputError(`${field} must be a number`);
  }

  return requireNumber(value, field);
}

function parseOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalResourceLimit(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError("resourceLimit must be a number");
  }

  return value;
}
