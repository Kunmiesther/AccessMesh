import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { AgentBudgetService } from "@/services/agent/AgentBudgetService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return jsonError(401, "AUTH_REQUIRED", "authentication required");
  }

  const service = new AgentBudgetService();
  const summary = await service.getBudgetSummaryForOwner(owner.ownerId);

  return NextResponse.json(
    {
      ok: true,
      summary,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
