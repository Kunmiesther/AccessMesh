import type { Resource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  parsePositiveUsdcAmount,
} from "@/lib/validation";
import { ActivityType, recordActivity } from "@/services/activityService";
import { getTreasuryWallet, splitUsdcAmount } from "@/services/paymentSplit";
import { verifyPublishFeePayment } from "@/services/publishingFeeService";
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
  const publishFeePayment = await verifyPublishFeePayment({
    txHash: input.publishTxHash,
    creatorWallet,
  }).catch((error: unknown) => {
    if (error instanceof InputError) {
      throw error;
    }

    throw new InputError(
      error instanceof Error
        ? `publish fee verification failed: ${error.message}`
        : "publish fee verification failed",
    );
  });

  if (publishFeePayment.verification.status !== "SETTLED") {
    throw new InputError(
      publishFeePayment.verification.reason ||
        "publish fee transaction has not settled on Arc",
    );
  }

  const existingResource = await prisma.resource.findUnique({
    where: { publishTxHash: publishFeePayment.txHash },
  });

  if (existingResource) {
    return serializeResource(existingResource);
  }

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
      publishTxHash: publishFeePayment.txHash,
      publishFeeUSDC: publishFeePayment.publishFeeUSDC,
      publishedAt: new Date(),
    },
  });

  await recordActivity({
    type: ActivityType.ResourcePublished,
    wallet: creatorWallet,
    resourceId: resource.id,
    title: resource.title || resource.name,
    txHash: publishFeePayment.txHash,
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
    ) ||
    Boolean(
      connectedWallet &&
        (await prisma.purchase.findUnique({
          where: {
            resourceId_buyerWallet: {
              resourceId: id,
              buyerWallet: connectedWallet,
            },
          },
        })),
    );

  const relatedResources = await getRelatedResourcePreviews(
    parseStoredStringArray(resource.aiRelatedResourceIds),
  );

  return toResourceDetail(resource, owned, relatedResources);
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

  const purchase = payment
    ? null
    : await prisma.purchase.findUnique({
        where: {
          resourceId_buyerWallet: {
            resourceId,
            buyerWallet: payerWallet,
          },
        },
      });

  return {
    allowed: Boolean(payment || purchase),
    reason: payment
      ? "SETTLED_PAYMENT_FOUND"
      : purchase
        ? "PURCHASE_FOUND"
        : "PAYMENT_REQUIRED",
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
  const previewText = buildPreviewText(resource);
  const aiTopics = parseStoredStringArray(resource.aiTopics);
  const aiRelatedResourceIds = parseStoredStringArray(resource.aiRelatedResourceIds);

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
    previewText,
    aiSummary: normalizeOptionalStoredText(resource.aiSummary) ?? null,
    aiTopics,
    aiCategory: normalizeOptionalStoredText(resource.aiCategory) ?? null,
    aiAudience: normalizeOptionalStoredText(resource.aiAudience) ?? null,
    aiCollection: normalizeOptionalStoredText(resource.aiCollection) ?? null,
    aiPlacement: normalizeStoredPlacement(resource.aiPlacement),
    aiRelatedResourceIds,
    aiReasoning: normalizeOptionalStoredText(resource.aiReasoning) ?? null,
    aiAnalyzedAt: resource.aiAnalyzedAt?.toISOString() ?? null,
    coverImage: resource.coverImage,
    tags: parseStoredTags(resource.tags),
    unlockCount: resource.unlockCount,
    isActive: resource.isActive,
    publishTxHash: resource.publishTxHash,
    publishFeeUSDC: resource.publishFeeUSDC,
    publishedAt: resource.publishedAt?.toISOString() ?? null,
    createdAt: resource.createdAt.toISOString(),
  };
}

function toResourceDetail(
  resource: ResourceRecord,
  owned: boolean,
  relatedResources: ResourceDetail["aiRelatedResources"] = [],
): ResourceDetail {
  const meta = serializeResource(resource);
  const resourceUrl = normalizeOptionalStoredText(resource.resourceUrl || resource.endpoint);
  const resourceContent = normalizeOptionalStoredText(resource.resourceContent);

  return {
    ...meta,
    aiRelatedResources: relatedResources,
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

function parseStoredStringArray(value: string | null | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

function buildPreviewText(resource: ResourceRecord) {
  const resourceType =
    normalizeStoredPublishedResourceType(resource.resourceType) ??
    inferStoredPublishedResourceType(resource);
  if (resourceType !== "ARTICLE") {
    return null;
  }

  const rawContent =
    normalizeOptionalStoredText(resource.resourceContent) ??
    decodeDataUrl(
      normalizeOptionalStoredText(resource.resourceUrl || resource.endpoint) ?? "",
    );

  if (!rawContent) {
    return null;
  }

  const normalized = stripMarkdown(rawContent)
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.length > 320
    ? `${normalized.slice(0, 317).trimEnd()}...`
    : normalized;
}

function inferStoredPublishedResourceType(resource: ResourceRecord) {
  const resourceUrl = normalizeOptionalStoredText(resource.resourceUrl || resource.endpoint) ?? "";
  const resourceContent = normalizeOptionalStoredText(resource.resourceContent) ?? "";

  if (resourceUrl.startsWith("data:text/markdown") || resourceContent.length > 0) {
    try {
      const parsed = JSON.parse(resourceContent);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { fileDataUrl?: unknown }).fileDataUrl === "string"
      ) {
        return "FILE_UPLOAD" as const;
      }
    } catch {
      return "ARTICLE" as const;
    }

    return "ARTICLE" as const;
  }

  return "EXTERNAL_LINK" as const;
}

function normalizeStoredPlacement(value: string | null | undefined) {
  if (
    value === "Featured" ||
    value === "Emerging" ||
    value === "Infrastructure" ||
    value === "AI Agents" ||
    value === "Payments" ||
    value === "Developer Tools" ||
    value === "Research" ||
    value === "Beginner Friendly"
  ) {
    return value;
  }

  return null;
}

async function getRelatedResourcePreviews(relatedIds: string[]) {
  if (relatedIds.length === 0) {
    return [];
  }

  const resources = await prisma.resource.findMany({
    where: {
      id: { in: relatedIds },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      name: true,
      priceUSDC: true,
      creatorWallet: true,
      creatorDisplayName: true,
    },
  });

  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  return relatedIds
    .map((id) => byId.get(id))
    .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource))
    .map((resource) => ({
      id: resource.id,
      title: resource.title || resource.name,
      priceUSDC: resource.priceUSDC,
      creatorWallet: resource.creatorWallet,
      creatorDisplayName:
        normalizeOptionalStoredText(resource.creatorDisplayName) ?? null,
    }));
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

function decodeDataUrl(value: string) {
  const commaIndex = value.indexOf(",");
  if (!value.startsWith("data:") || commaIndex === -1) {
    return value;
  }

  const meta = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);

  if (meta.includes(";base64")) {
    return Buffer.from(payload, "base64").toString("utf8");
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~]/g, "");
}
