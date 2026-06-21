import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import {
  verifyPaymentSettlement,
  verifySettlement,
} from "@/services/paymentOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const txHash = requireString(body.txHash, "txHash");
    const verification = await verifyPaymentSettlement(txHash);

    return NextResponse.json({
      ok: verification.payment.status === "SETTLED",
      payment: verification.payment,
      verification: verification.result,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PAYMENT_VERIFY_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "PAYMENT_VERIFY_FAILED", "payment verification failed");
  }
}

export async function GET(request: Request) {
  try {
    const txHash = new URL(request.url).searchParams.get("txHash");
    const settled = await verifySettlement(requireString(txHash, "txHash"));

    return NextResponse.json({
      ok: true,
      settled,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PAYMENT_VERIFY_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "PAYMENT_VERIFY_FAILED", "payment verification failed");
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
