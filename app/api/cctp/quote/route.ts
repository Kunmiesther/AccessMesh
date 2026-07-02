import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { getForwardingQuote } from "@/services/cctpIrisService";
import {
  isSupportedCctpSourceKey,
  type SupportedCctpSourceKey,
} from "@/lib/cctp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sourceKey = requireSourceKey(url.searchParams.get("source"));
    const amount = requireAtomicAmount(url.searchParams.get("amount"));
    const quote = await getForwardingQuote({
      sourceKey,
      amount,
    });

    return NextResponse.json({
      ok: true,
      quote,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "CCTP_QUOTE_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "CCTP_QUOTE_FAILED", "CCTP quote failed");
  }
}

function requireSourceKey(value: string | null): SupportedCctpSourceKey {
  if (isSupportedCctpSourceKey(value)) {
    return value;
  }

  throw new InputError("unsupported CCTP source chain");
}

function requireAtomicAmount(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    throw new InputError("amount must be a positive USDC subunit integer");
  }

  const amount = BigInt(value);
  if (amount <= BigInt(0)) {
    throw new InputError("amount must be positive");
  }

  return amount;
}
