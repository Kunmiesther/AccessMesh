import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { submitTxHash } from "@/services/paymentOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const txHash = requireString(body.txHash, "txHash");
    const resourceId = requireString(body.resourceId, "resourceId");
    const wallet = requireString(body.wallet, "wallet");
    const result = await submitTxHash(txHash, resourceId, wallet);

    return NextResponse.json({
      ok: result.payment.status === "SETTLED",
      payment: result.payment,
      verification: result.verification,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PAYMENT_SUBMIT_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "PAYMENT_SUBMIT_FAILED", "payment submission failed");
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
