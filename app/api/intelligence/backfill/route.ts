import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { backfillAccessMeshIntelligence } from "@/services/accessMeshIntelligenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await parseOptionalJson(request);
    const limit = parseOptionalLimit(body?.limit);
    const force = body?.force === true;
    const result = await backfillAccessMeshIntelligence({ limit, force });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INTELLIGENCE_BACKFILL_INVALID", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "INTELLIGENCE_BACKFILL_FAILED",
      "resource intelligence backfill could not be completed",
    );
  }
}

async function parseOptionalJson(request: Request) {
  try {
    return (await request.json()) as {
      limit?: unknown;
      force?: unknown;
    };
  } catch {
    return {};
  }
}

function parseOptionalLimit(value: unknown) {
  if (value === undefined || value === null) {
    return 10;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError("limit must be a number");
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    throw new InputError("limit must be between 1 and 100");
  }

  return normalized;
}
