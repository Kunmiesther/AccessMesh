import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError } from "@/lib/validation";
import { getForwardedMintMessage } from "@/services/cctpIrisService";
import type { SupportedCctpSourceKey } from "@/lib/cctp-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sourceKey = requireSourceKey(url.searchParams.get("source"));
    const transactionHash = requireString(
      url.searchParams.get("transactionHash"),
      "transactionHash",
    );
    const status = await getForwardedMintMessage({
      sourceKey,
      transactionHash,
    });

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "CCTP_STATUS_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "CCTP_STATUS_FAILED", "CCTP status lookup failed");
  }
}

function requireSourceKey(value: string | null): SupportedCctpSourceKey {
  if (value === "base-sepolia") {
    return value;
  }

  throw new InputError("unsupported CCTP source chain");
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
