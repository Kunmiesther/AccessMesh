import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWalletFromRequest, InputError } from "@/lib/validation";
import { unlockAccess } from "@/services/accessFlowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await unlockAccess({
      accessId: body.accessId,
      txHash: body.txHash,
      payerWallet: getWalletFromRequest(request),
    });

    const status = result.ok
      ? 200
      : result.verification.status === "FAILED"
        ? 402
        : 202;

    const responseBody = result.ok
      ? {
          ...result,
          accessToken: undefined,
          tokenType: undefined,
        }
      : result;
    const response = NextResponse.json(responseBody, { status });

    if (result.ok && result.accessToken) {
      response.cookies.set({
        name: "accessmesh_access",
        value: result.accessToken,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.max(
          60,
          Math.floor(
            (new Date(result.expiresAt ?? Date.now() + 3600_000).getTime() -
              Date.now()) /
              1000,
          ),
        ),
      });
    }

    return response;
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "ACCESS_UNLOCK_INVALID", error.message);
    }

    console.error(error);
    return jsonError(500, "ACCESS_UNLOCK_FAILED", "access unlock failed");
  }
}
