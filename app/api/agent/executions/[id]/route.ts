import { NextResponse } from "next/server";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { buildAgentExecutionDetailView } from "@/services/agent/AgentExecutionViews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return NextResponse.json(
      {
        ok: false,
        error: "authentication required",
      },
      { status: 401 },
    );
  }

  const { id } = await params;
  const owned = await getOwnedAgentExecution(
    request,
    id,
    new AgentExecutionRepository(),
  );

  if (!owned) {
    return NextResponse.json(
      {
        ok: false,
        error: "execution not found",
      },
      { status: 404 },
    );
  }

  const execution = buildAgentExecutionDetailView(owned.execution);

  return NextResponse.json({
    ok: true,
    execution,
  });
}
