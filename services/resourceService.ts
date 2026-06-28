import type { Resource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  parsePositiveUsdcAmount,
} from "@/lib/validation";
import { ActivityType, recordActivity } from "@/services/activityService";
import { getTreasuryWallet, splitUsdcAmount } from "@/services/paymentSplit";
import type {
  CreateResourceRequest,
  PublishedResourceType,
  ResourceDetail,
  ResourceMeta,
  ResourceType,
} from "@/types";

const RESOURCE_TYPES = ["API", "CONTENT", "TOOL", "DATASET"] as const;
const PUBLISHED_RESOURCE_TYPES = [
  "ARTICLE",
  "FILE_UPLOAD",
  "EXTERNAL_LINK",
] as const;

type ResourceRecord = Resource;

type ListResourcesOptions = {
  ownerId?: string;
  includeInactive?: boolean;
  limit?: number;
};

export async function createResource(input: CreateResourceRequest) {
  const creatorWallet = normalizeAddress(input.creatorWallet, "creatorWallet");
  const creatorDisplayName = normalizeOptionalText(input.creatorDisplayName);
  const title = requireText(input.title, "title");
  const description = requireText(input.description, "description");
  const resourceCategory = requireText(input.category, "category");
  const resourceType = resolvePublishedResourceType(input);
  const priceUSDC = parsePositiveUsdcAmount(input.priceUSDC);
  const { resourceUrl, resourceContent } = buildResourceAsset(
    input,
    resourceType,
  );
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
      creatorDisplayName,
      title,
      name: title,
      description,
      category: "CONTENT",
      type: "CONTENT",
      resourceCategory,
      resourceType,
      resourceContent,
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

  return serializeResource(resource);
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

  return resources.map((item) => serializeResource(item));
}

export async function getResource(id: string) {
  const resource = await prisma.resource.findUnique({
    where: { id },
  });

  return resource ? serializeResource(resource) : null;
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
      resource: resource ? serializeResource(resource) : null,
      payment: null,
    };
  }

  if (payerWallet === resource.creatorWallet) {
    return {
      allowed: true,
      reason: "CREATOR_WALLET_FOUND",
      resource: serializeResource(resource),
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
    resource: serializeResource(resource),
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

export async function getResourcePaymentParticipants(resourceId: string) {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { owner: true },
  });

  if (!resource || !resource.isActive) {
    throw new InputError("resource not found or inactive");
  }

  const creatorWallet = normalizeAddress(resource.owner.walletAddress, "creatorWallet");
  const treasuryWallet = getTreasuryWallet();
  if (!treasuryWallet) {
    throw new InputError("AccessMesh treasury wallet is not configured");
  }
  const split = splitUsdcAmount(resource.priceUSDC);

  return {
    resource,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC: split.creatorAmountUSDC,
    treasuryAmountUSDC: split.treasuryAmountUSDC,
  };
}

export function serializeResource(resource: ResourceRecord): ResourceMeta {
  const type = normalizeStoredResourceType(resource.type || resource.category);
  const resourceType = normalizeStoredPublishedResourceType(resource.resourceType);

  return {
    id: resource.id,
    creatorWallet: resource.creatorWallet,
    creatorDisplayName: normalizeOptionalStoredText(resource.creatorDisplayName) ?? null,
    title: resource.title || resource.name,
    name: resource.name,
    description: resource.description,
    category: normalizeStoredResourceType(resource.category),
    type,
    resourceCategory: normalizeOptionalStoredText(resource.resourceCategory) ?? "",
    resourceType,
    priceUSDC: resource.priceUSDC,
    coverImage: resource.coverImage,
    tags: parseStoredTags(resource.tags),
    unlockCount: resource.unlockCount,
    isActive: resource.isActive,
    createdAt: resource.createdAt.toISOString(),
  };
}

function toResourceDetail(resource: ResourceRecord, owned: boolean): ResourceDetail {
  const meta = serializeResource(resource);
  const resourceUrl = normalizeOptionalStoredText(resource.resourceUrl || resource.endpoint);
  const resourceContent = normalizeOptionalStoredText(resource.resourceContent);

  return {
    ...meta,
    owned,
    resourceUrl: owned ? resourceUrl : undefined,
    endpoint: owned ? resourceUrl : undefined,
    resourceContent: owned ? resourceContent : undefined,
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

function normalizePublishedResourceType(
  value: unknown,
): PublishedResourceType {
  if (typeof value !== "string") {
    throw new InputError("resourceType is required");
  }

  const normalized = value.toUpperCase();
  if (!PUBLISHED_RESOURCE_TYPES.includes(normalized as PublishedResourceType)) {
    throw new InputError(
      "resourceType must be ARTICLE, FILE_UPLOAD, or EXTERNAL_LINK",
    );
  }

  return normalized as PublishedResourceType;
}

function resolvePublishedResourceType(input: CreateResourceRequest) {
  if (input.resourceType) {
    return normalizePublishedResourceType(input.resourceType);
  }

  if (normalizeOptionalText(input.articleContent)) {
    return "ARTICLE";
  }

  if (normalizeOptionalText(input.fileDataUrl)) {
    return "FILE_UPLOAD";
  }

  const externalUrl = normalizeOptionalText(input.externalUrl ?? input.resourceUrl);
  if (externalUrl) {
    return "EXTERNAL_LINK";
  }

  throw new InputError(
    "resourceType is required unless articleContent, fileDataUrl, or externalUrl is provided",
  );
}

function buildResourceAsset(
  input: CreateResourceRequest,
  resourceType: PublishedResourceType,
) {
  switch (resourceType) {
    case "ARTICLE": {
      const markdown = requireText(input.articleContent, "articleContent");
      return {
        resourceUrl: toDataUrl("text/markdown;charset=utf-8", markdown),
        resourceContent: markdown,
      };
    }
    case "FILE_UPLOAD": {
      const fileName = requireText(input.fileName, "fileName");
      const fileDataUrl = requireText(input.fileDataUrl, "fileDataUrl");
      validateFileUpload(fileName, fileDataUrl, input.fileMimeType);
      return {
        resourceUrl: fileDataUrl,
        resourceContent: JSON.stringify({
          fileName,
          fileMimeType: normalizeOptionalText(input.fileMimeType),
          fileDataUrl,
        }),
      };
    }
    case "EXTERNAL_LINK": {
      const externalUrl = requireText(
        input.externalUrl ?? input.resourceUrl,
        "externalUrl",
      );
      const normalizedUrl = normalizeHttpUrl(externalUrl);
      return {
        resourceUrl: normalizedUrl,
        resourceContent: normalizedUrl,
      };
    }
  }
}

function normalizeStoredResourceType(value: string): ResourceType {
  return RESOURCE_TYPES.includes(value as ResourceType)
    ? (value as ResourceType)
    : "CONTENT";
}

function normalizeStoredPublishedResourceType(value: string) {
  return PUBLISHED_RESOURCE_TYPES.includes(value as PublishedResourceType)
    ? (value as PublishedResourceType)
    : null;
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

function normalizeOptionalStoredText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeHttpUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InputError("externalUrl must start with http:// or https://");
  }

  return parsed.toString();
}

function validateFileUpload(
  fileName: string,
  fileDataUrl: string,
  fileMimeType?: string | null,
) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const allowedExtensions = new Set(["pdf", "zip", "docx"]);
  if (!extension || !allowedExtensions.has(extension)) {
    throw new InputError("file uploads must be PDF, ZIP, or DOCX files");
  }

  const normalizedMimeType = fileMimeType?.trim().toLowerCase();
  const allowedMimeTypes = new Set([
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (
    normalizedMimeType &&
    !allowedMimeTypes.has(normalizedMimeType) &&
    !normalizedMimeType.startsWith("application/octet-stream")
  ) {
    throw new InputError("file uploads must be PDF, ZIP, or DOCX files");
  }

  if (!fileDataUrl.startsWith("data:")) {
    throw new InputError("fileDataUrl must be a data URL");
  }
}

function toDataUrl(mimeType: string, content: string) {
  return `data:${mimeType},${encodeURIComponent(content)}`;
}
