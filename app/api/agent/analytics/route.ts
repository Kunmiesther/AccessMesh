import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import {
  AgentExecutionAnalyticsService,
  parseAgentAnalyticsPeriod,
} from "@/services/agent/AgentExecutionAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const url = new URL(request.url);
    const parsed = parseAgentAnalyticsPeriod(url.searchParams.get("period"));

    if (!parsed.ok) {
      return jsonError(400, "INVALID_QUERY", parsed.error);
    }

    const service = new AgentExecutionAnalyticsService();
    const analytics = await service.getAnalyticsForOwner({
      ownerId: owner.ownerId,
      period: parsed.period,
    });

    const response = NextResponse.json({
      ok: true,
      analytics,
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
