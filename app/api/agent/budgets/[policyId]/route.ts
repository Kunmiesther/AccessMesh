import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { AgentBudgetService } from "@/services/agent/AgentBudgetService";
import { InputError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return jsonError(401, "AUTH_REQUIRED", "authentication required");
  }

  const { policyId } = await params;
  if (typeof policyId !== "string" || policyId.trim().length === 0) {
    return jsonError(400, "INVALID_POLICY", "policyId is required");
  }

  const service = new AgentBudgetService();
  try {
    const budget = await service.getBudgetForPolicy(owner.ownerId, policyId.trim());

    return NextResponse.json(
      {
        ok: true,
        budget,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(404, "POLICY_NOT_FOUND", "policy not found");
    }

    throw error;
  }
}
