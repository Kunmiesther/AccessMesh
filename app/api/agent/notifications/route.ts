import { NextResponse } from "next/server";
import { requireAgentOwner, UnauthorizedAgentOwnerError } from "@/lib/auth/requireAgentOwner";
import { jsonError } from "@/lib/http";
import {
  AgentNotificationRepository,
  decodeAgentNotificationCursor,
} from "@/services/agent/AgentNotificationRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = requireAgentOwner(request);
    const url = new URL(request.url);
    const filter = parseFilter(url.searchParams.get("filter"));
    if (filter === null) {
      return jsonError(400, "INVALID_QUERY", "filter is invalid");
    }

    const limit = parseLimit(url.searchParams.get("limit"));
    if (limit === null) {
      return jsonError(400, "INVALID_QUERY", "limit must be a positive integer");
    }

    const cursor = decodeAgentNotificationCursor(url.searchParams.get("cursor"));
    if (url.searchParams.has("cursor") && !cursor) {
      return jsonError(400, "INVALID_QUERY", "cursor is invalid");
    }

    const repository = new AgentNotificationRepository();
    const page = await repository.listNotificationsForOwner({
      ownerId: owner.ownerId,
      limit,
      cursor,
      filter,
    });
    const unreadCount = await repository.getUnreadCount(owner.ownerId);

    const response = NextResponse.json({
      ok: true,
      notifications: page.notifications,
      unreadCount,
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

function parseFilter(value: string | null) {
  if (value === null || value === "" || value === "all") {
    return "all" as const;
  }

  if (value === "unread") {
    return "unread" as const;
  }

  return null;
}

function parseLimit(value: string | null) {
  if (value === null || value === "") {
    return 20;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, 20);
}
