import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { unlockAccess } from "@/services/accessFlowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await unlockAccess({
      accessId: body.accessId,
      txHash: body.txHash,
    });

    const status = result.ok
      ? 200
      : result.verification.status === "FAILED"
        ? 402
        : 202;

    return NextResponse.json(result, { status });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "ACCESS_UNLOCK_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "ACCESS_UNLOCK_FAILED", "access unlock failed");
  }
}
