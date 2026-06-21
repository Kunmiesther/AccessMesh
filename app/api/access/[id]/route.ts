import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import { createAccessPaymentIntent } from "@/services/accessFlowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const walletInput = getWalletFromRequest(request);

  try {
    const paymentIntent = await createAccessPaymentIntent({
      resourceId: id,
      payerWallet: walletInput ?? "",
      fallbackRecipientWallet:
        request.headers.get("x-recipient-wallet") ??
        url.searchParams.get("recipientWallet"),
      fallbackAmountUSDC: url.searchParams.get("amountUSDC"),
    });

    return NextResponse.json({
      ok: true,
      paymentIntent,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "ACCESS_INTENT_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "ACCESS_INTENT_FAILED", "access intent failed");
  }
}
