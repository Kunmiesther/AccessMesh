import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import { recordActivity, ActivityType } from "@/services/activityService";
import { resolveProtectedResourceAccess } from "@/services/protectedResourceService";

export async function handleProtectedResourceGET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await resolveProtectedResourceAccess({
      resourceId: id,
      walletInput: getWalletFromRequest(request),
      requestUrl: request.url,
    });

    if (access.status === 402) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message:
              "A settled AccessMesh Arc USDC unlock is required before x402 content access.",
          },
          resource: access.resource,
          accepts: access.paymentRequired.accepts,
          x402: access.paymentRequired,
          accessRequired: {
            resourceId: id,
            wallet: access.wallet,
            unlockUrl: access.paymentRequired.unlockUrl,
          },
        },
        {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": access.headerValue,
          },
        },
      );
    }

    console.info("UNLOCK STEP 9 Resource unlocked", {
      resourceId: id,
      wallet: access.wallet,
    });

    await recordActivity({
      type: ActivityType.ProtectedResourceAccessed,
      wallet: access.wallet,
      resourceId: id,
      title: access.resource.title || access.resource.name,
      txHash: access.access?.payment?.txHash,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      resource: access.resource,
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
