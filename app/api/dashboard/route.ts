import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { normalizeOptionalAddress } from "@/lib/validation";
import {
  getCreatedResourceSummaries,
  getCreatorAnalytics,
  getProtocolStats,
} from "@/services/analyticsService";
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

    const [stats, analytics, purchasedResources, createdResources] =
      await Promise.all([
        getProtocolStats(),
        getCreatorAnalytics(wallet),
        listWalletPurchases(wallet),
        getCreatedResourceSummaries(wallet),
      ]);

    return NextResponse.json({
      ok: true,
      stats,
      analytics,
      purchasedResources,
      createdResources,
      paymentHistory: purchasedResources,
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "DASHBOARD_FAILED", "dashboard data could not be fetched");
  }
}
