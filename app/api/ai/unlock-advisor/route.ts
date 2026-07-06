import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError, normalizeOptionalAddress } from "@/lib/validation";
import {
  AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE,
  generateUnlockAdvisor,
} from "@/services/aiUnlockAdvisorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resourceId = requireString(body.resourceId, "resourceId");
    const wallet = normalizeOptionalAddress(body.wallet);
    const result = await generateUnlockAdvisor({
      resourceId,
      wallet,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        message: result.message || AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE,
      });
    }

    return NextResponse.json({
      ok: true,
      advisor: result.advisor,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "UNLOCK_ADVISOR_INVALID", error.message);
    }

    console.error(error);
    return NextResponse.json({
      ok: false,
      message: AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE,
    });
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
