import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import { AgentNotificationRepository } from "@/services/agent/AgentNotificationRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = requireAgentOwner(request);
    const { id } = await params;
    const repository = new AgentNotificationRepository();
    const notification = await repository.markNotificationAsRead(owner.ownerId, id);

    if (!notification) {
      return jsonError(404, "NOTIFICATION_NOT_FOUND", "notification not found");
    }

    const response = NextResponse.json({
      ok: true,
      notification,
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
