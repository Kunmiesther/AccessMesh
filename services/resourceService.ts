import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  parsePositiveUsdcAmount,
} from "@/lib/validation";

const resourceTypes = new Set(["API", "CONTENT", "TOOL", "DATASET"]);

export async function createResource(input: {
  ownerId?: string;
  ownerWallet?: string;
  name: string;
  type: string;
  endpoint: string;
  description: string;
  priceUSDC: number | string;
}) {
  const ownerId = await resolveOwnerId(input.ownerId, input.ownerWallet);
  const name = requireString(input.name, "name");
  const type = requireString(input.type, "type").toUpperCase();
  const endpoint = requireString(input.endpoint, "endpoint");
  const description = requireString(input.description, "description");
  const priceUSDC = parsePositiveUsdcAmount(input.priceUSDC);

  if (!resourceTypes.has(type)) {
    throw new InputError("type must be API, CONTENT, TOOL, or DATASET");
  }

  return prisma.resource.create({
    data: {
      ownerId,
      name,
      type,
      endpoint,
      description,
      priceUSDC,
    },
  });
}

export async function getResource(id: string) {
  return prisma.resource.findUnique({
    where: { id },
  });
}

export async function listResources(params?: {
  ownerId?: string;
  includeInactive?: boolean;
  limit?: number;
}) {
  return prisma.resource.findMany({
    where: {
      ...(params?.ownerId ? { ownerId: params.ownerId } : {}),
      ...(params?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
    ...(params?.limit ? { take: params.limit } : {}),
  });
}

export async function validateAccess(resourceId: string, wallet: string) {
  const payerWallet = normalizeAddress(wallet, "wallet");
  const resource = await getResource(resourceId);

  if (!resource || !resource.isActive) {
    return {
      allowed: false,
      reason: "RESOURCE_NOT_FOUND_OR_INACTIVE",
      resource,
      payment: null,
    };
  }

  const payment = await prisma.payment.findFirst({
    where: {
      resourceId,
      payerWallet,
      status: "SETTLED",
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    allowed: Boolean(payment),
    reason: payment ? "SETTLED_PAYMENT_FOUND" : "PAYMENT_REQUIRED",
    resource,
    payment,
  };
}

export async function getResourceProviderWallet(resourceId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource || !resource.isActive) {
    throw new InputError("resource not found or inactive");
  }

  const owner = await prisma.user.findUnique({
    where: { id: resource.ownerId },
  });

  if (!owner) {
    throw new InputError("resource owner not found");
  }

  return {
    resource,
    providerWallet: normalizeAddress(owner.walletAddress, "providerWallet"),
  };
}

async function resolveOwnerId(ownerId?: string, ownerWallet?: string) {
  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) {
      throw new InputError("ownerId does not reference an existing provider");
    }

    return owner.id;
  }

  if (!ownerWallet) {
    throw new InputError("ownerWallet or ownerId is required");
  }

  const walletAddress = normalizeAddress(ownerWallet, "ownerWallet");
  const owner = await prisma.user.upsert({
    where: { walletAddress },
    create: {
      walletAddress,
      role: "PROVIDER",
    },
    update: {
      role: "PROVIDER",
    },
  });

  return owner.id;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}
