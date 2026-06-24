import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const activity = await prisma.accessLog.findMany({
    where: {
      status: {
        in: ["UNLOCKED", "ACCESS_GRANTED", "PAYMENT_CONFIRMED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const resourceIds = Array.from(
    new Set(activity.map((entry) => entry.resourceId)),
  );
  const resources = await prisma.resource.findMany({
    where: { id: { in: resourceIds } },
    select: { id: true, name: true, type: true },
  });
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource]),
  );

  return NextResponse.json({
    ok: true,
    activity: activity.map((entry) => ({
      id: entry.id,
      resourceId: entry.resourceId,
      resourceName:
        resourcesById.get(entry.resourceId)?.name ?? entry.resourceId,
      resourceType: resourcesById.get(entry.resourceId)?.type ?? "CONTENT",
      payerWallet: entry.payerWallet,
      status: entry.status,
      txHash: entry.txHash,
      createdAt: entry.createdAt,
    })),
  });
}
