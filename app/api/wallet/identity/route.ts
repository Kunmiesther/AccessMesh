import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { InputError, normalizeAddress } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const walletAddress = normalizeAddress(body.wallet, "wallet");
    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: {
        walletAddress,
        role: "CONSUMER",
      },
      update: {},
    });

    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_WALLET", error.message);
    }

    console.error(error);
    return jsonError(
      500,
      "WALLET_IDENTITY_FAILED",
      "wallet identity could not be restored",
    );
  }
}
