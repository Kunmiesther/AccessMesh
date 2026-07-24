import { NextResponse } from "next/server";
import { InputError } from "@/lib/validation";
import { runAgentApplication } from "@/services/agent/AgentApplicationService";
import type { AgentApplicationInput } from "@/services/agent/AgentApplicationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAgentRunRequest(request);
}

export async function handleAgentRunRequest(
  request: Request,
  runApplication = runAgentApplication,
) {
  try {
    const body = await parseJsonBody(request);
    const input = parseAgentRunInput(body);
    const result = await runApplication(input);

    return NextResponse.json({
      ok: true,
      result,
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

function parseAgentRunInput(body: unknown): AgentApplicationInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("request body must be an object");
  }

  const goal = requireString((body as Record<string, unknown>).goal, "goal");
  const policy = requirePolicy((body as Record<string, unknown>).policy);
  const resourceLimit = parseOptionalResourceLimit(
    (body as Record<string, unknown>).resourceLimit,
  );

  return {
    goal,
    policy,
    ...(resourceLimit !== undefined ? { resourceLimit } : {}),
  };
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function requirePolicy(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("policy is required");
  }

  const record = value as Record<string, unknown>;

  return {
    remainingBudgetUSDC: requireNumber(
      record.remainingBudgetUSDC,
      "policy.remainingBudgetUSDC",
    ),
    maxPurchaseUSDC: requireNumber(
      record.maxPurchaseUSDC,
      "policy.maxPurchaseUSDC",
    ),
    minimumMatchScore: requireNumber(
      record.minimumMatchScore,
      "policy.minimumMatchScore",
    ),
  };
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError(`${field} must be a number`);
  }

  return value;
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
