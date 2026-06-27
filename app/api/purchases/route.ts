import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError, normalizeOptionalAddress } from "@/lib/validation";
import { listWalletPurchases } from "@/services/purchaseService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wallet = normalizeOptionalAddress(url.searchParams.get("wallet"));

    if (!wallet) {
      return jsonError(400, "WALLET_REQUIRED", "wallet is required");
    }

    const purchases = await listWalletPurchases(wallet);

    return NextResponse.json({
      ok: true,
      purchases,
      paymentHistory: purchases,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PURCHASE_LIST_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "PURCHASE_LIST_FAILED", "purchases could not be fetched");
  }
}
