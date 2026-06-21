import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { normalizeOptionalAddress } from "@/lib/validation";
import { getLedger } from "@/services/ledgerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payerWallet = normalizeOptionalAddress(url.searchParams.get("wallet"));
    const resourceId = url.searchParams.get("resourceId") ?? undefined;
    const limit = parseLimit(url.searchParams.get("limit"));
    const ledger = await getLedger({ payerWallet, resourceId, limit });

    return NextResponse.json({
      ok: true,
      ledger,
    });
  } catch (error) {
    console.error(error);
    return jsonError(400, "LEDGER_FETCH_FAILED", "ledger could not be fetched");
  }
}

function parseLimit(value: string | null) {
  if (!value) {
    return 100;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    return 100;
  }

  return parsed;
}
