import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [totalResources, totalUnlocks, settledVolume, totalCreators] =
    await Promise.all([
      prisma.resource.count({ where: { isActive: true } }),
      prisma.accessLog.count({
        where: {
          status: {
            in: ["UNLOCKED", "ACCESS_GRANTED", "PAYMENT_CONFIRMED"],
          },
        },
      }),
      prisma.payment.aggregate({
        where: { status: "SETTLED" },
        _sum: { amountUSDC: true },
      }),
      prisma.user.count({ where: { role: "PROVIDER" } }),
    ]);

  return NextResponse.json({
    ok: true,
    stats: {
      totalResources,
      totalUnlocks,
      totalUSDCVolume: settledVolume._sum.amountUSDC ?? 0,
      totalCreators,
    },
  });
}
