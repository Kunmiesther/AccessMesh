import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = requireAgentOwner(request);
    const { id } = await params;
    const repository = new AgentApprovalRepository();
    const approval = await repository.getApprovalForOwner(owner.ownerId, id);

    if (!approval) {
      return jsonError(404, "APPROVAL_NOT_FOUND", "approval not found");
    }

    const response = NextResponse.json({
      ok: true,
      approval,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedAgentOwnerError) {
      return jsonError(401, "UNAUTHORIZED", "authentication required");
    }

    throw error;
  }
}
