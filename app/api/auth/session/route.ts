import { NextResponse } from "next/server";
import { getAgentOwnerFromRequest } from "@/lib/auth/requireAgentOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = getAgentOwnerFromRequest(request);

  return NextResponse.json({
    ok: true,
    authenticated: Boolean(owner),
    owner: owner
      ? {
          ownerId: owner.ownerId,
          walletAddress: owner.walletAddress,
          username: owner.username,
          authenticationMethod: owner.authenticationMethod,
        }
      : null,
  });
}
