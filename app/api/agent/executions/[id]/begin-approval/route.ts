import { NextResponse } from "next/server";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { jsonError } from "@/lib/http";
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

  const repository = new AgentExecutionRepository();
  const execution = await repository.markAwaitingApproval(id);

  return NextResponse.json({
    ok: true,
    execution,
  });
}
