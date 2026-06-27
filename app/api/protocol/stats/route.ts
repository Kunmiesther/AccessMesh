import { NextResponse } from "next/server";
import { getProtocolStats } from "@/services/analyticsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getProtocolStats();

  return NextResponse.json({
    ok: true,
    stats,
  });
}
