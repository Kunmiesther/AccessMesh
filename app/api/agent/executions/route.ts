import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import {
  parseAgentExecutionHistoryQuery,
} from "@/services/agent/AgentExecutionHistory";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const url = new URL(request.url);
    const parsed = parseAgentExecutionHistoryQuery({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status"),
      decision: url.searchParams.get("decision"),
    });

    if (!parsed.ok) {
      return jsonError(400, "INVALID_QUERY", parsed.error);
    }

    const repository = new AgentExecutionRepository();
    const page = await repository.listExecutionsForOwner({
      ownerId: owner.ownerId,
      limit: parsed.query.limit,
      cursor: parsed.query.cursor,
      status: parsed.query.status,
      decision: parsed.query.decision,
    });

    const response = NextResponse.json({
      ok: true,
      executions: page.executions,
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
