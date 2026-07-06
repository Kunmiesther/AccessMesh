import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/validation";
import type { PurchaseProof } from "@/types";

export type OwnedResourceAdvisorSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  tags: string[];
  priceUSDC: number;
};

export async function listWalletPurchases(wallet: string) {
  const buyerWallet = normalizeAddress(wallet, "wallet");
  const purchases = await prisma.purchase.findMany({
    where: { buyerWallet },
    include: {
      resource: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return purchases.map((purchase): PurchaseProof => ({
    id: purchase.id,
    resourceId: purchase.resourceId,
    resourceTitle: purchase.resource.title || purchase.resource.name,
    buyerWallet: purchase.buyerWallet,
    creatorWallet: purchase.creatorWallet,
    creatorDisplayName: normalizeOptionalStoredText(
      purchase.resource.creatorDisplayName,
    ) ?? null,
    amountUSDC: purchase.amountUSDC,
    txHash: purchase.txHash,
    timestamp: purchase.createdAt.toISOString(),
  }));
}

export async function listOwnedResourcesForAdvisor(
  wallet: string,
  excludeResourceId?: string,
) {
  const buyerWallet = normalizeAddress(wallet, "wallet");
  const purchases = await prisma.purchase.findMany({
    where: {
      buyerWallet,
      ...(excludeResourceId ? { resourceId: { not: excludeResourceId } } : {}),
    },
    include: {
      resource: true,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return purchases.map((purchase): OwnedResourceAdvisorSummary => ({
    id: purchase.resourceId,
    title: purchase.resource.title || purchase.resource.name,
    description: purchase.resource.description,
    category:
      normalizeOptionalStoredText(purchase.resource.resourceCategory) ??
      purchase.resource.category,
    creator:
      normalizeOptionalStoredText(purchase.resource.creatorDisplayName) ??
      purchase.resource.creatorWallet,
    tags: parseStoredTags(purchase.resource.tags),
    priceUSDC: purchase.amountUSDC,
  }));
}

function normalizeOptionalStoredText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
