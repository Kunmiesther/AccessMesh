import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { initiatePayment } from "@/services/paymentOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resourceId = requireString(body.resourceId, "resourceId");
    const wallet = requireString(body.wallet, "wallet");
    const requirement = await initiatePayment(resourceId, wallet);

    return NextResponse.json({
      ok: true,
      paymentRequired: requirement,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "PAYMENT_INITIATE_INVALID", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "PAYMENT_INITIATE_FAILED",
      "payment initiation failed",
    );
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
