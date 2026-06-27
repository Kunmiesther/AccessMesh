import type { Resource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  parsePositiveUsdcAmount,
} from "@/lib/validation";
import { ActivityType, recordActivity } from "@/services/activityService";
import type {
  CreateResourceRequest,
  ResourceDetail,
  ResourceMeta,
  ResourceType,
} from "@/types";

const RESOURCE_TYPES = ["API", "CONTENT", "TOOL", "DATASET"] as const;

type ListResourcesOptions = {
  ownerId?: string;
  includeInactive?: boolean;
  limit?: number;
};

export async function createResource(input: CreateResourceRequest) {
  const creatorWallet = normalizeAddress(input.creatorWallet, "creatorWallet");
  const title = requireText(input.title, "title");
  const description = requireText(input.description, "description");
  const category = normalizeResourceType(input.category);
  const priceUSDC = parsePositiveUsdcAmount(input.priceUSDC);
  const resourceUrl = normalizeResourceLocation(input);
  const coverImage = normalizeOptionalText(input.coverImage);
  const tags = normalizeTags(input.tags);

  const owner = await prisma.user.upsert({
    where: { walletAddress: creatorWallet },
    create: {
      walletAddress: creatorWallet,
      role: "PROVIDER",
    },
    update: {
      role: "PROVIDER",
    },
  });

  const resource = await prisma.resource.create({
    data: {
      ownerId: owner.id,
      creatorWallet,
      title,
      name: title,
      description,
      category,
      type: category,
      priceUSDC,
      resourceUrl,
      endpoint: resourceUrl,
      coverImage,
      tags: JSON.stringify(tags),
      unlockCount: 0,
      isActive: true,
    },
  });

  await recordActivity({
    type: ActivityType.ResourcePublished,
    wallet: creatorWallet,
    resourceId: resource.id,
    title: resource.title || resource.name,
  }).catch(() => undefined);

  return toResourceMeta(resource);
}

export async function listResources(options: ListResourcesOptions = {}) {
  const resources = await prisma.resource.findMany({
    where: {
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit,
  });

  return resources.map(toResourceMeta);
}

export async function getResource(id: string) {
  const resource = await prisma.resource.findUnique({
    where: { id },
  });

  return resource ? toResourceMeta(resource) : null;
}

export async function getResourceDetail(id: string, wallet?: string | null) {
  const resource = await prisma.resource.findUnique({
    where: { id },
  });

  if (!resource) {
    return null;
  }

  const connectedWallet = wallet ? normalizeAddress(wallet, "wallet") : null;
  const owned =
    Boolean(connectedWallet && connectedWallet === resource.creatorWallet) ||
    Boolean(
      connectedWallet &&
        (await prisma.payment.findFirst({
          where: {
            resourceId: id,
            payerWallet: connectedWallet,
            status: "SETTLED",
          },
          orderBy: { createdAt: "desc" },
        })),
    );

  return toResourceDetail(resource, owned);
}

export async function validateAccess(resourceId: string, wallet: string) {
  const payerWallet = normalizeAddress(wallet, "wallet");
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource || !resource.isActive) {
    return {
      allowed: false,
      reason: "RESOURCE_NOT_FOUND_OR_INACTIVE",
      resource: resource ? toResourceMeta(resource) : null,
      payment: null,
    };
  }

  if (payerWallet === resource.creatorWallet) {
    return {
      allowed: true,
      reason: "CREATOR_WALLET_FOUND",
      resource: toResourceMeta(resource),
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
    resource: toResourceMeta(resource),
    payment,
  };
}

export async function getResourceProviderWallet(resourceId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { owner: true },
  });

  if (!resource || !resource.isActive) {
    throw new InputError("resource not found or inactive");
  }

  return {
    resource,
    providerWallet: normalizeAddress(resource.owner.walletAddress, "providerWallet"),
  };
}

function toResourceMeta(resource: Resource): ResourceMeta {
  const type = normalizeStoredResourceType(resource.type || resource.category);

  return {
    id: resource.id,
    creatorWallet: resource.creatorWallet,
    title: resource.title || resource.name,
    name: resource.name,
    description: resource.description,
    category: normalizeStoredResourceType(resource.category),
    type,
    priceUSDC: resource.priceUSDC,
    resourceUrl: resource.resourceUrl || resource.endpoint,
    endpoint: resource.endpoint,
    coverImage: resource.coverImage,
    tags: parseStoredTags(resource.tags),
    unlockCount: resource.unlockCount,
    isActive: resource.isActive,
    createdAt: resource.createdAt.toISOString(),
  };
}

function toResourceDetail(resource: Resource, owned: boolean): ResourceDetail {
  const meta = toResourceMeta(resource);

  return {
    ...meta,
    owned,
    resourceUrl: owned ? meta.resourceUrl : undefined,
    endpoint: owned ? meta.endpoint : undefined,
  };
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeResourceLocation(input: CreateResourceRequest) {
  const resourceUrl = normalizeOptionalText(input.resourceUrl);
  const fileDataUrl = normalizeOptionalText(input.fileDataUrl);

  if (resourceUrl) {
    return resourceUrl;
  }

  if (fileDataUrl) {
    return fileDataUrl;
  }

  throw new InputError("resourceUrl or file upload is required");
}

function normalizeResourceType(value: unknown): ResourceType {
  if (typeof value !== "string") {
    throw new InputError("category is required");
  }

  const normalized = value.toUpperCase();
  if (!RESOURCE_TYPES.includes(normalized as ResourceType)) {
    throw new InputError("category must be API, CONTENT, TOOL, or DATASET");
  }

  return normalized as ResourceType;
}

function normalizeStoredResourceType(value: string): ResourceType {
  return RESOURCE_TYPES.includes(value as ResourceType)
    ? (value as ResourceType)
    : "CONTENT";
}

function normalizeTags(value: CreateResourceRequest["tags"]) {
  if (!value) {
    return [];
  }

  const rawTags = Array.isArray(value) ? value : value.split(",");
  return Array.from(
    new Set(
      rawTags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 12),
    ),
  );
}

function parseStoredTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === "string");
    }
  } catch {
    return [];
  }

  return [];
}
