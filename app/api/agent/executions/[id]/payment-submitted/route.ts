import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { AgentNotificationRepository } from "@/services/agent/AgentNotificationRepository";
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
    return jsonError(400, "INVALID_PAYMENT", "request body must be an object");
  }

  const transactionId = requireString((body as Record<string, unknown>).transactionId, "transactionId");
  const resourceId = requireString((body as Record<string, unknown>).resourceId, "resourceId");
  const resourceTitle = requireString((body as Record<string, unknown>).resourceTitle, "resourceTitle");
  const amountUSDC = requireNumber((body as Record<string, unknown>).amountUSDC, "amountUSDC");

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
  const approvalRepository = new AgentApprovalRepository();
  try {
    const approval = await approvalRepository.getApprovalForExecution(owner.ownerId, id);
    if (!approval) {
      return jsonError(409, "APPROVAL_REQUIRED", "approval is required before payment can be submitted");
    }

    if (approval.approvalStatus !== "APPROVED") {
      return jsonError(409, "APPROVAL_REQUIRED", "approval must be approved before payment can be submitted");
    }

    const execution = await repository.recordPaymentSubmitted(id, {
      transactionId,
      amountUSDC,
      resourceId,
      resourceTitle,
    });

    await new AgentNotificationRepository().ensureNotification({
      ownerId: owner.ownerId,
      type: "PAYMENT_SUBMITTED",
      title: "Payment submitted",
      message: `The Arc payment for "${resourceTitle}" was submitted.`,
      entityType: "execution",
      entityId: id,
      actionPath: `/agent/executions/${id}`,
      dedupeKey: `payment-submitted:${id}`,
    });

    return NextResponse.json({
      ok: true,
      execution,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_PAYMENT", error.message);
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

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError(`${field} must be a number`);
  }

  return value;
}
