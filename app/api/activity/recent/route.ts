import { NextResponse } from "next/server";
import { listRecentActivity } from "@/services/activityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const activity = await listRecentActivity(10);

  return NextResponse.json({
    ok: true,
    activity: activity.map((entry) => ({
      id: entry.id,
      type: entry.type,
      wallet: entry.wallet,
      resourceId: entry.resourceId,
      resourceTitle: entry.title || entry.resource.title || entry.resource.name,
      resourceName: entry.resource.title || entry.resource.name,
      resourceType: normalizeResourceType(
        entry.resource.type || entry.resource.category,
      ),
      payerWallet: entry.wallet,
      txHash: entry.txHash,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}

function normalizeResourceType(value: string) {
  if (
    value === "API" ||
    value === "CONTENT" ||
    value === "TOOL" ||
    value === "DATASET"
  ) {
    return value;
  }

  return "CONTENT";
}
