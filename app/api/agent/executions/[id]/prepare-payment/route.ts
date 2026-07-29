import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { AgentBudgetConflictError } from "@/services/agent/AgentBudgetRepository";
import { AgentBudgetService } from "@/services/agent/AgentBudgetService";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { InputError } from "@/lib/validation";

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

  const budgetService = new AgentBudgetService();
  try {
    const result = await budgetService.preparePaymentForExecution(owner.ownerId, id);

    return NextResponse.json({
      ok: true,
      budget: result.bucket,
      reservation: result.reservation,
      activity: result.activity ?? null,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_PREPARE_PAYMENT", error.message);
    }

    if (error instanceof AgentBudgetConflictError) {
      return jsonError(409, "BUDGET_CONFLICT", error.message);
    }

    throw error;
  }
}
