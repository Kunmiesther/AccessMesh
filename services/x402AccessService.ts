import type { Resource } from "@prisma/client";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_WALLET } from "@/lib/validation";
import type {
  AccessMeshIntelligencePlacement,
  PaymentRequiredAgentMetadata,
  PaymentRequiredMetadata,
  PaymentRequiredResourceMetadata,
  PaymentRequiredRetryMetadata,
} from "@/types";

export const X402AccessResult = {
  Success: "SUCCESS",
  Failed: "FAILED",
} as const;

type X402AccessResultValue =
  (typeof X402AccessResult)[keyof typeof X402AccessResult];

export async function recordX402Access(params: {
  resourceId: string;
  wallet?: string | null;
  result: X402AccessResultValue;
}) {
  return prisma.x402AccessLog.create({
    data: {
      resourceId: params.resourceId,
      wallet: params.wallet || UNKNOWN_WALLET,
      result: params.result,
    },
  });
}

export function buildX402AccessRequired(params: {
  resource: Resource;
  providerWallet: string;
  requestUrl: string;
}) {
  const paymentRequired = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        price: `$${params.resource.priceUSDC}`,
        network: `eip155:${ArcTestnet.chainId}`,
        payTo: params.providerWallet,
      },
    ],
    description: `Unlock ${params.resource.title || params.resource.name} on AccessMesh`,
    mimeType: "application/json",
    resource: params.requestUrl,
    unlockUrl: `/access/${params.resource.id}`,
  };

  return {
    paymentRequired,
    headerValue: JSON.stringify(paymentRequired),
  };
}

type AccessMetadataResource = {
  id: string;
  title?: string | null;
  name: string;
  description: string;
  priceUSDC: number;
  category?: string;
  resourceCategory?: string | null;
  creatorWallet: string;
  creatorDisplayName?: string | null;
  tags?: string | string[] | null;
  aiSummary?: string | null;
  aiTopics?: string | string[] | null;
  aiCategory?: string | null;
  aiAudience?: string | null;
  aiCollection?: string | null;
  aiPlacement?: string | null;
  aiRelatedResourceIds?: string | string[] | null;
};

export function buildPaymentMetadata(params: {
  resourceId: string;
  priceUSDC: number;
}) {
  return {
    url: `/access/${params.resourceId}`,
    price: params.priceUSDC.toFixed(2),
    currency: "USDC",
    network: "Arc Testnet",
  } satisfies PaymentRequiredMetadata;
}

export function buildPaymentRequiredResourceMetadata(
  resource: AccessMetadataResource,
) {
  const category =
    normalizeOptionalText(resource.aiCategory) ??
    normalizeOptionalText(resource.resourceCategory) ??
    normalizeOptionalText(resource.category);
  const topics = normalizeTopics(resource.aiTopics ?? resource.tags);
  const creator =
    normalizeOptionalText(resource.creatorDisplayName) ?? resource.creatorWallet;
  const summary =
    normalizeOptionalText(resource.aiSummary) ?? resource.description;
  const audience = normalizeOptionalText(resource.aiAudience);
  const collection = normalizeOptionalText(resource.aiCollection);
  const placement = normalizePlacement(resource.aiPlacement);
  const relatedResourceIds = normalizeTopics(resource.aiRelatedResourceIds);

  return {
    title: normalizeOptionalText(resource.title) ?? resource.name,
    summary,
    creator,
    ...(category ? { category } : {}),
    ...(topics.length > 0 ? { topics } : {}),
    ...(audience ? { audience } : {}),
    ...(collection ? { collection } : {}),
    ...(placement ? { placement } : {}),
    ...(relatedResourceIds.length > 0 ? { relatedResourceIds } : {}),
  } satisfies PaymentRequiredResourceMetadata;
}

export function buildPaymentRequiredAgentMetadata() {
  return {
    decisionContext:
      "This payment challenge includes discovery metadata so automated clients can reason about whether the protected resource is relevant to their current task.",
    retryAfterPayment: true,
  } satisfies PaymentRequiredAgentMetadata;
}

export function buildPaymentRequiredRetryMetadata(wallet?: string | null) {
  return {
    method: "GET",
    ...(wallet
      ? {
          headers: {
            "x-accessmesh-wallet": wallet,
          },
        }
      : {}),
  } satisfies PaymentRequiredRetryMetadata;
}

export async function getX402Analytics(params?: { creatorWallet?: string }) {
  const where = params?.creatorWallet
    ? { resource: { creatorWallet: params.creatorWallet } }
    : {};

  const [protectedRequests, successfulAccesses, failedAccesses] =
    await Promise.all([
      prisma.x402AccessLog.count({ where }),
      prisma.x402AccessLog.count({
        where: { ...where, result: X402AccessResult.Success },
      }),
      prisma.x402AccessLog.count({
        where: { ...where, result: X402AccessResult.Failed },
      }),
    ]);

  return {
    protectedRequests,
    successfulAccesses,
    failedAccesses,
    conversionRate:
      protectedRequests > 0 ? successfulAccesses / protectedRequests : 0,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTopics(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter((topic): topic is string => typeof topic === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((topic): topic is string => typeof topic === "string");
    }
  } catch {
    return [];
  }

  return [];
}

function normalizePlacement(value: string | null | undefined) {
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
    return value as AccessMeshIntelligencePlacement;
  }

  return undefined;
}
