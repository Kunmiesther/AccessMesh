import { NextResponse } from "next/server";
import { listResources } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const resources = await listResources({ limit: 100 });

  return NextResponse.json({
    ok: true,
    resources,
  });
}
