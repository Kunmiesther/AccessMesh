import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return jsonError(401, "AUTH_REQUIRED", "authentication required");
  }

  const { id } = await params;
  const owned = await getOwnedAgentExecution(
    request,
    id,
    new AgentExecutionRepository(),
  );

  if (!owned) {
    return jsonError(404, "EXECUTION_NOT_FOUND", "execution not found");
  }

  const approvalRepository = new AgentApprovalRepository();
  const approval = await approvalRepository.getApprovalForExecution(owner.ownerId, id);
  if (!approval || approval.approvalStatus !== "APPROVED") {
    return jsonError(409, "APPROVAL_REQUIRED", "approval must be approved before settlement can be verified");
  }

  const repository = new AgentExecutionRepository();
  const execution = await repository.markSettlementVerification(id);

  return NextResponse.json({
    ok: true,
    execution,
  });
}
