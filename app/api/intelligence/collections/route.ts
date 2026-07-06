import { NextResponse } from "next/server";
import { listAccessMeshIntelligenceCollections } from "@/services/accessMeshIntelligenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const collections = await listAccessMeshIntelligenceCollections();

  return NextResponse.json({
    ok: true,
    collections,
  });
}
