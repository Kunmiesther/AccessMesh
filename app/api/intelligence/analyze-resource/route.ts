import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { analyzeResourceIntelligence } from "@/services/accessMeshIntelligenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resourceId = requireString(body.resourceId, "resourceId");
    const intelligence = await analyzeResourceIntelligence(resourceId);

    return NextResponse.json({
      ok: true,
      intelligence,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INTELLIGENCE_ANALYZE_INVALID", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "INTELLIGENCE_ANALYZE_FAILED",
      "resource intelligence could not be generated",
    );
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
