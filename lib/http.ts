import { NextResponse } from "next/server";

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export function paymentRequired(body: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "PAYMENT_REQUIRED",
        message: "A settled Arc Testnet USDC payment is required before access.",
      },
      paymentRequired: body,
    },
    { status: 402 },
  );
}
