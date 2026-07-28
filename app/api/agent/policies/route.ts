import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { AgentPolicyConflictError, AgentPolicyRepository } from "@/services/agent/AgentPolicyRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const repository = new AgentPolicyRepository();
    const policies = await repository.listPoliciesForOwner(owner.ownerId);

    const response = NextResponse.json({
      ok: true,
      policies,
      defaultPolicyId: policies.find((policy) => policy.isDefault)?.id ?? null,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedAgentOwnerError) {
      return jsonError(401, "AUTH_REQUIRED", "authentication required");
    }

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const body = await parseJsonObject(request);
    const repository = new AgentPolicyRepository();
    const policy = await repository.createPolicy(owner.ownerId, body as never);

    const response = NextResponse.json({
      ok: true,
      policy,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedAgentOwnerError) {
      return jsonError(401, "AUTH_REQUIRED", "authentication required");
    }

    if (error instanceof InputError) {
      return jsonError(400, "INVALID_POLICY", error.message);
    }

    if (error instanceof AgentPolicyConflictError) {
      return jsonError(409, "POLICY_CONFLICT", error.message);
    }

    throw error;
  }
}

async function parseJsonObject(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new InputError("request body must be an object");
    }

    return body;
  } catch (error) {
    if (error instanceof InputError) {
      throw error;
    }

    throw new InputError("request body must be valid JSON");
  }
}

