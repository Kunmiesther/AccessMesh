import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentNotificationRepository } from "@/services/agent/AgentNotificationRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const repository = new AgentNotificationRepository();
    const count = await repository.getUnreadCount(owner.ownerId);

    const response = NextResponse.json({
      ok: true,
      count,
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
