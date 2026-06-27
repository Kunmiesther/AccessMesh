import { NextResponse } from "next/server";
import { getResourceProviderWallet, validateAccess } from "@/services/resourceService";
import {
  buildX402AccessRequired,
  recordX402Access,
  X402AccessResult,
} from "@/services/x402AccessService";
import { ActivityType, recordActivity } from "@/services/activityService";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError, normalizeAddress } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const walletInput = getWalletFromRequest(request);
  const requestUrl = request.url;

  try {
    const wallet = walletInput ? normalizeAddress(walletInput, "wallet") : null;
    const { resource, providerWallet } = await getResourceProviderWallet(id);

    if (!wallet) {
      await recordX402Access({
        resourceId: id,
        wallet: null,
        result: X402AccessResult.Failed,
      });

      return x402AccessRequired({
        resource,
        providerWallet,
        requestUrl,
        wallet: null,
      });
    }

    const access = await validateAccess(id, wallet);

    if (!access.allowed) {
      await recordX402Access({
        resourceId: id,
        wallet,
        result: X402AccessResult.Failed,
      });

      return x402AccessRequired({
        resource,
        providerWallet,
        requestUrl,
        wallet,
      });
    }

    await recordX402Access({
      resourceId: id,
      wallet,
      result: X402AccessResult.Success,
    });

    await recordActivity({
      type: ActivityType.ProtectedResourceAccessed,
      wallet,
      resourceId: id,
      title: resource.title || resource.name,
      txHash: access.payment?.txHash,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      content: {
        resourceId: id,
        title: resource.title || resource.name,
        resourceUrl: resource.resourceUrl || resource.endpoint,
        openUrl: resource.resourceUrl || resource.endpoint,
        deliveredVia: "x402-access-layer",
      },
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PROTECTED_CONTENT_INVALID", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "PROTECTED_CONTENT_FAILED",
      "protected content could not be fetched",
    );
  }
}

function x402AccessRequired(params: {
  resource: Awaited<ReturnType<typeof getResourceProviderWallet>>["resource"];
  providerWallet: string;
  requestUrl: string;
  wallet: string | null;
}) {
  const { paymentRequired, headerValue } = buildX402AccessRequired({
    resource: params.resource,
    providerWallet: params.providerWallet,
    requestUrl: params.requestUrl,
  });

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "PAYMENT_REQUIRED",
        message:
          "A settled AccessMesh Arc USDC unlock is required before x402 content access.",
      },
      accepts: paymentRequired.accepts,
      x402: paymentRequired,
      accessRequired: {
        resourceId: params.resource.id,
        wallet: params.wallet,
        unlockUrl: paymentRequired.unlockUrl,
      },
    },
    {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": headerValue,
      },
    },
  );
}
