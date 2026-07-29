import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";
import { parseAgentApprovalListQuery } from "@/services/agent/AgentApprovalValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const url = new URL(request.url);
    const parsed = parseAgentApprovalListQuery({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status"),
    });

    if (!parsed.ok) {
      return jsonError(400, "INVALID_QUERY", parsed.error);
    }

    const repository = new AgentApprovalRepository();
    const page = await repository.listApprovalsForOwner({
      ownerId: owner.ownerId,
      limit: parsed.query.limit,
      cursor: parsed.query.cursor,
      status: parsed.query.status,
    });
    const pendingCount = await repository.getPendingApprovalCount(owner.ownerId);

    const response = NextResponse.json({
      ok: true,
      approvals: page.approvals,
      pendingCount,
      pageInfo: {
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
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
