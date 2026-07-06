import { NextResponse } from "next/server";
import { buildCircleSendRequirement } from "@/lib/circle";
import { jsonError } from "@/lib/http";
import { InputError, normalizeAddress } from "@/lib/validation";
import { logAccessDenied, logRequestAttempted } from "@/services/ledgerService";
import { getResourceProviderWallet, validateAccess } from "@/services/resourceService";
import {
  buildPaymentMetadata,
  buildPaymentRequiredAgentMetadata,
  buildPaymentRequiredResourceMetadata,
  buildPaymentRequiredRetryMetadata,
} from "@/services/x402AccessService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resourceId = requireString(body.resourceId, "resourceId");
    const wallet = normalizeAddress(body.wallet, "wallet");

    await logRequestAttempted({
      resourceId,
      payerWallet: wallet,
    });

    const access = await validateAccess(resourceId, wallet);

    if (!access.resource || !access.resource.isActive) {
      await logAccessDenied({ resourceId, payerWallet: wallet });
      return jsonError(404, "RESOURCE_NOT_FOUND", "resource not found");
    }

    if (!access.allowed) {
      const { resource, providerWallet } =
        await getResourceProviderWallet(resourceId);
      const payment = buildPaymentMetadata({
        resourceId,
        priceUSDC: resource.priceUSDC,
      });

      await logAccessDenied({ resourceId, payerWallet: wallet });

      return NextResponse.json(
        {
          ok: false,
          error: "Payment required",
          code: "ACCESSMESH_PAYMENT_REQUIRED",
          resourceId,
          payment,
          resource: buildPaymentRequiredResourceMetadata(resource),
          agent: buildPaymentRequiredAgentMetadata(),
          retry: buildPaymentRequiredRetryMetadata(wallet),
          allowed: false,
          paymentRequired: {
            resourceId,
            amount: resource.priceUSDC,
            currency: "USDC",
            providerWallet,
            payerWallet: wallet,
            payment: buildCircleSendRequirement({
              amountUSDC: resource.priceUSDC,
              providerWallet,
            }),
          },
        },
        { status: 402 },
      );
    }

    return NextResponse.json({
      ok: true,
      allowed: true,
      txHash: access.payment?.txHash,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "ACCESS_CHECK_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "ACCESS_CHECK_FAILED", "access check failed");
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
