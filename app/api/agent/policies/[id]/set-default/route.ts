import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentPolicyConflictError, AgentPolicyRepository } from "@/services/agent/AgentPolicyRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = requireAgentOwner(request);
    const { id } = await params;
    const repository = new AgentPolicyRepository();
    const policy = await repository.setDefaultPolicy(owner.ownerId, id);

    if (!policy) {
      return jsonError(404, "POLICY_NOT_FOUND", "policy not found");
    }

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

    if (error instanceof AgentPolicyConflictError) {
      return jsonError(409, "POLICY_CONFLICT", error.message);
    }

    throw error;
  }
}

