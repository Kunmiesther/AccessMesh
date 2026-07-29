import { NextResponse } from "next/server";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";
import { getOwnedAgentExecution } from "@/lib/auth/requireOwnedAgentExecution";
import { jsonError } from "@/lib/http";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";
import { AgentNotificationRepository } from "@/services/agent/AgentNotificationRepository";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import { unlockAccess } from "@/services/accessFlowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const owner = getAgentOwnerFromRequest(request);
    if (!owner) {
      return jsonError(401, "ACCESS_UNLOCK_UNAUTHORIZED", "authentication required");
    }
    const executionId = typeof body.executionId === "string" ? body.executionId : null;
    const wallet = owner.walletAddress ?? getWalletFromRequest(request);

    const ownedExecution = executionId
      ? await getOwnedAgentExecution(
          request,
          executionId,
          new AgentExecutionRepository(),
        )
      : null;

    if (executionId && !ownedExecution) {
      return jsonError(404, "ACCESS_UNLOCK_NOT_FOUND", "execution not found");
    }

    if (ownedExecution) {
      await new AgentExecutionRepository().markUnlocking(executionId);
    }

    const result = await unlockAccess({
      accessId: body.accessId,
      txHash: body.txHash,
      payerWallet: wallet,
    });

    const status = result.ok
      ? 200
      : result.verification.status === "FAILED"
        ? 402
        : 202;

    const responseBody = result.ok
      ? {
          ...result,
          accessToken: undefined,
          tokenType: undefined,
        }
      : result;
    const response = NextResponse.json(responseBody, { status });

    if (ownedExecution) {
      const repository = new AgentExecutionRepository();
      if (result.ok) {
        await repository.completeExecution(executionId, {
          transactionId: result.txHash ?? body.txHash,
          amountUSDC: body.amountUSDC ?? null,
          resourceId: body.resourceId ?? ownedExecution.execution.selectedResourceId ?? null,
        });

        await new AgentNotificationRepository().ensureNotification({
          ownerId: owner.ownerId,
          type: "UNLOCK_COMPLETED",
          title: "Unlock completed",
          message: "The purchased resource was verified and unlocked successfully.",
          entityType: "execution",
          entityId: executionId,
          actionPath: `/agent/executions/${executionId}`,
          dedupeKey: `unlock-completed:${executionId}`,
        });

        await new AgentNotificationRepository().ensureNotification({
          ownerId: owner.ownerId,
          type: "EXECUTION_COMPLETED",
          title: "Execution completed",
          message: "The purchase and unlock were completed.",
          entityType: "execution",
          entityId: executionId,
          actionPath: `/agent/executions/${executionId}`,
          dedupeKey: `execution-completed:${executionId}`,
        });
      } else if (result.verification.status === "FAILED") {
        await repository.failExecution(executionId, {
          code: "UNLOCK_FAILED",
          message:
            result.verification.reason ??
            "The access unlock could not be completed.",
          stage: "UNLOCKING",
        });

        await new AgentNotificationRepository().ensureNotification({
          ownerId: owner.ownerId,
          type: "EXECUTION_FAILED",
          title: "Execution failed",
          message: result.verification.reason ?? "The access unlock could not be completed.",
          entityType: "execution",
          entityId: executionId,
          actionPath: `/agent/executions/${executionId}`,
          dedupeKey: `execution-failed:${executionId}`,
        });
      }
    }

    if (result.ok && result.accessToken) {
      response.cookies.set({
        name: "accessmesh_access",
        value: result.accessToken,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.max(
          60,
          Math.floor(
            (new Date(result.expiresAt ?? Date.now() + 3600_000).getTime() -
              Date.now()) /
              1000,
          ),
        ),
      });
    }

    return response;
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "ACCESS_UNLOCK_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "ACCESS_UNLOCK_FAILED", "access unlock failed");
  }
}
