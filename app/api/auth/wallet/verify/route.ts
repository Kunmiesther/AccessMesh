import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import {
  createAgentOwnerSessionPayload,
  setAgentOwnerSessionCookie,
} from "@/lib/auth/agentOwnerSession";
import { verifyCircleLogin } from "@/lib/auth/circleWalletAuthentication";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/validation";
import type { PublicKeyCredential } from "webauthn-p256";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleWalletVerifyRequest(request);
}

type WalletVerifyDeps = {
  verifyLogin?: typeof verifyCircleLogin;
  upsertUser?: (args: {
    where: { walletAddress: string };
    create: {
      walletAddress: string;
      role: "CONSUMER";
    };
    update: Record<string, never>;
  }) => Promise<{
    id: string;
    walletAddress: string;
  }>;
};

export async function handleWalletVerifyRequest(
  request: Request,
  deps: WalletVerifyDeps = {},
) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new InputError("request body must be an object");
    }

    const record = body as Record<string, unknown>;
    const username = normalizeUsername(record.username);
    const credential = normalizeCredential(record.credential);
    const verifyLogin = deps.verifyLogin ?? verifyCircleLogin;
    const upsertUser =
      deps.upsertUser ??
      (async (args: Parameters<typeof prisma.user.upsert>[0]) => prisma.user.upsert(args));

    const verifiedLogin = await verifyLogin({
      username,
      credential,
    });

    const user = await upsertUser({
      where: { walletAddress: verifiedLogin.walletAddress },
      create: {
        walletAddress: verifiedLogin.walletAddress,
        role: "CONSUMER",
      },
      update: {},
    });

    const owner = {
      ownerId: user.id,
      walletAddress: verifiedLogin.walletAddress,
      username,
      authenticationMethod: verifiedLogin.authenticationMethod,
    } as const;
    const response = NextResponse.json({
      ok: true,
      owner,
    });

    setAgentOwnerSessionCookie(response, createAgentOwnerSessionPayload(owner));

    return response;
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "AUTH_INVALID", error.message);
    }

    console.error(error);
    return jsonError(401, "AUTH_FAILED", "wallet authentication failed");
  }
}

function normalizeUsername(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError("username is required");
  }

  return value.trim();
}

function normalizeCredential(value: unknown): PublicKeyCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("credential is required");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    throw new InputError("credential.id is required");
  }

  return value as PublicKeyCredential;
}
