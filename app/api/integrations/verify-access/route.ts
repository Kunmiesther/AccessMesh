import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { InputError, normalizeAddress } from "@/lib/validation";
import { validateAccess } from "@/services/resourceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAuthorizeRequest(request);
}

export async function handleAuthorizeRequest(request: Request) {
  try {
    const body = await request.json();
    const resourceId = requireString(body.resourceId, "resourceId");
    const walletAddress = normalizeAddress(
      body.walletAddress,
      "walletAddress",
    );
    const access = await validateAccess(resourceId, walletAddress);

    if (!access.resource || !access.resource.isActive) {
      return jsonError(404, "RESOURCE_NOT_FOUND", "resource not found");
    }

    const resource = buildResourceMetadata(access.resource);

    return NextResponse.json(
      access.allowed
        ? {
            authorized: true,
            hasAccess: true,
            resourceId,
            walletAddress,
            resource,
          }
        : {
            authorized: false,
            hasAccess: false,
            resourceId,
            walletAddress,
            payment: {
              status: "required",
              paymentUrl: buildResourceUrl(request.url, resourceId),
              currency: "USDC",
              network: "Arc Testnet",
            },
            resource,
          },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof InputError) {
      return jsonError(
        400,
        "VERIFY_ACCESS_INVALID",
        error.message,
      );
    }

    if (error instanceof SyntaxError) {
      return jsonError(
        400,
        "VERIFY_ACCESS_INVALID_JSON",
        "request body must be valid JSON",
      );
    }

    console.error(error);
    return jsonError(
      500,
      "VERIFY_ACCESS_FAILED",
      "access verification failed",
    );
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function buildResourceMetadata(resource: {
  title?: string | null;
  name?: string | null;
  priceUSDC?: number | null;
  creatorDisplayName?: string | null;
  creatorWallet?: string | null;
}) {
  const metadata: Record<string, unknown> = {
    currency: "USDC",
    network: "Arc Testnet",
  };

  const title = normalizeOptionalText(resource.title) || normalizeOptionalText(resource.name);
  if (title) {
    metadata.title = title;
  }

  if (typeof resource.priceUSDC === "number" && Number.isFinite(resource.priceUSDC)) {
    metadata.price = resource.priceUSDC.toString();
  }

  const creator =
    normalizeOptionalText(resource.creatorDisplayName) ||
    normalizeOptionalText(resource.creatorWallet);
  if (creator) {
    metadata.creator = creator;
  }

  return metadata;
}

function buildResourceUrl(requestUrl: string, resourceId: string) {
  return new URL(`/resource/${resourceId}`, requestUrl).toString();
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
