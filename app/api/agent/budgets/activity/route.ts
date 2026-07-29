import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { AgentBudgetService } from "@/services/agent/AgentBudgetService";
import { decodeBudgetActivityCursor } from "@/services/agent/AgentBudgetRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = getAgentOwnerFromRequest(request);
  if (!owner) {
    return jsonError(401, "AUTH_REQUIRED", "authentication required");
  }

  const url = new URL(request.url);
  const limitResult = parseLimit(url.searchParams.get("limit"));
  if (!limitResult.ok) {
    return jsonError(400, "INVALID_LIMIT", limitResult.error);
  }
  const limit = limitResult.value;
  const cursor = decodeBudgetActivityCursor(url.searchParams.get("cursor"));

  if (url.searchParams.has("cursor") && url.searchParams.get("cursor") && !cursor) {
    return jsonError(400, "INVALID_CURSOR", "cursor is invalid");
  }

  const service = new AgentBudgetService();
  const page = await service.listBudgetActivityForOwner(owner.ownerId, limit, cursor);

  return NextResponse.json(
    {
      ok: true,
      page,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function parseLimit(value: string | null):
  | { ok: true; value: number }
  | { ok: false; error: string } {
  if (value === null || value.trim().length === 0) {
    return { ok: true, value: 20 };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: "limit must be a positive integer" };
  }

  return { ok: true, value: Math.min(parsed, 50) };
}
