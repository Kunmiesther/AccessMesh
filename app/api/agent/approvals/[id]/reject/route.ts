import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentApprovalConflictError, AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";
import { validateAgentApprovalRejectInput } from "@/services/agent/AgentApprovalValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = requireAgentOwner(request);
    const body = await request.json().catch(() => null);
    const parsed = validateAgentApprovalRejectInput(body);
    if (!parsed.ok) {
      return jsonError(400, "INVALID_REJECTION", parsed.error);
    }

    const { id } = await params;
    const repository = new AgentApprovalRepository();
    const result = await repository.rejectExecution(id, owner.ownerId, parsed.value);

    if (!result) {
      return jsonError(404, "APPROVAL_NOT_FOUND", "approval not found");
    }

    const response = NextResponse.json({
      ok: true,
      approval: result.approval,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedAgentOwnerError) {
      return jsonError(401, "UNAUTHORIZED", "authentication required");
    }

    if (error instanceof AgentApprovalConflictError) {
      return jsonError(409, "APPROVAL_CONFLICT", error.message);
    }

    throw error;
  }
}
