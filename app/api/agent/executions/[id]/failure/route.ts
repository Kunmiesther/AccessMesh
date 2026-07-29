import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { AgentNotificationRepository } from "@/services/agent/AgentNotificationRepository";
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "INVALID_FAILURE", "request body must be an object");
  }

  const record = body as Record<string, unknown>;
  const code = requireString(record.code, "code");
  const message = requireString(record.message, "message");
  const stage =
    typeof record.stage === "string" && record.stage.trim().length > 0
      ? record.stage.trim()
      : undefined;

  const { id } = await params;
  const owned = await getOwnedAgentExecution(
    request,
    id,
    new AgentExecutionRepository(),
  );

  if (!owned) {
    return jsonError(404, "EXECUTION_NOT_FOUND", "execution not found");
  }

  const repository = new AgentExecutionRepository();
  try {
    const execution = await repository.failExecution(id, {
      code,
      message,
      ...(stage ? { stage } : {}),
    });

    await new AgentNotificationRepository().ensureNotification({
      ownerId: owner.ownerId,
      type: "EXECUTION_FAILED",
      title: "Execution failed",
      message: `An execution stopped during ${stage ?? "execution"}.`,
      entityType: "execution",
      entityId: id,
      actionPath: `/agent/executions/${id}`,
      dedupeKey: `execution-failed:${id}`,
    });

    return NextResponse.json({
      ok: true,
      execution,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_FAILURE", error.message);
    }

    throw error;
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
