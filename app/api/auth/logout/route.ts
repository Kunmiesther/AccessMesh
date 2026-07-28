import { NextResponse } from "next/server";
import { clearAgentOwnerSessionCookie } from "@/lib/auth/agentOwnerSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
  });

  clearAgentOwnerSessionCookie(response);

  return response;
}
