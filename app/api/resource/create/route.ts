import { after, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import {
  getWalletFromRequest,
  InputError,
  normalizeAddress,
  normalizeOptionalAddress,
} from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { analyzeResourceIntelligence } from "@/services/accessMeshIntelligenceService";
import { createResource, listResources } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ownerWallet = normalizeOptionalAddress(
      url.searchParams.get("ownerWallet"),
    );
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    if (!ownerWallet) {
      return jsonError(400, "OWNER_WALLET_REQUIRED", "ownerWallet is required");
    }

    const owner = await prisma.user.findUnique({
      where: { walletAddress: ownerWallet },
    });

    if (!owner) {
      return NextResponse.json({
        ok: true,
        resources: [],
      });
    }

    const resources = await listResources({
      ownerId: owner.id,
      includeInactive,
    });

    return NextResponse.json({
      ok: true,
      resources,
    });
  } catch (error) {
    console.error(error);
    return jsonError(400, "RESOURCE_LIST_FAILED", "resources could not be fetched");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wallet = getWalletFromRequest(request);
    const creatorWallet = wallet
      ? normalizeAddress(wallet, "wallet")
      : normalizeAddress(body.creatorWallet, "creatorWallet");

    if (body.creatorWallet) {
      const submittedWallet = normalizeAddress(body.creatorWallet, "creatorWallet");
      if (submittedWallet !== creatorWallet) {
        throw new InputError("creator wallet does not match authenticated wallet");
      }
    }

    const resource = await createResource({
      ...body,
      creatorWallet,
    });

    after(async () => {
      await analyzeResourceIntelligence(resource.id).catch((error: unknown) => {
        console.error("AccessMesh Intelligence analysis failed", {
          resourceId: resource.id,
          error,
        });
      });
    });

    return NextResponse.json({
      ok: true,
      resource,
    });
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(400, "INVALID_RESOURCE", error.message);
    }

    console.error(error);
    return jsonError(500, "RESOURCE_CREATE_FAILED", "resource could not be created");
  }
}
