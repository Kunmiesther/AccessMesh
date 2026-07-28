import { NextResponse } from "next/server";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";

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

  const execution = owned.execution;
  const reasoning = execution.reasoning;
  const purchase = reasoning?.purchase ?? null;

  return NextResponse.json({
    ok: true,
    execution: {
      id: execution.id,
      status: execution.status,
      goal: reasoning?.goal ?? execution.goal,
      decision: execution.decision,
      policy: reasoning?.policy ?? null,
      normalizedGoal: reasoning?.normalizedGoal ?? null,
      candidateCount: reasoning?.candidateCount ?? 0,
      comparisonSummary: reasoning?.comparisonSummary ?? null,
      selectedResource: reasoning?.selectedResource ?? null,
      selectedEvaluation: reasoning?.selectedEvaluation ?? null,
      candidates: reasoning?.candidateSummaries ?? [],
      trace: reasoning?.trace ?? [],
      purchase: purchase
        ? {
            status: purchase.status,
            amountUSDC: purchase.amountUSDC,
            transactionId: purchase.transactionId,
            resourceId: purchase.resourceId,
            settlementVerified: purchase.settlementStatus === "SETTLED",
            settlementStatus: purchase.settlementStatus,
            unlocked: purchase.unlockStatus === "UNLOCKED",
            unlockStatus: purchase.unlockStatus,
          }
        : null,
      createdAt: execution.startedAt,
      completedAt: execution.completedAt,
    },
  });
}
