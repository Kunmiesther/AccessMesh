import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/validation";
import {
  ActivityType,
  listRecentActivity,
  listRecentActivityByType,
} from "@/services/activityService";
import { serializeResource } from "@/services/resourceService";
import { getX402Analytics } from "@/services/x402AccessService";
import type {
  CreatedResourceSummary,
  CreatorAnalytics,
  CreatorProfile,
  ProtocolStats,
  RecentActivityEntry,
} from "@/types";

const CREATOR_REVENUE_SHARE = 0.95;

export async function getProtocolStats(): Promise<ProtocolStats> {
  const [totalResources, purchases, settledPayments, creators] =
    await Promise.all([
      prisma.resource.count({ where: { isActive: true } }),
      prisma.purchase.findMany({
        select: { txHash: true, amountUSDC: true },
      }),
      prisma.payment.findMany({
        where: { status: "SETTLED" },
        select: { txHash: true, amountUSDC: true },
      }),
      prisma.resource.findMany({
        where: {
          isActive: true,
          creatorWallet: {
            not: "",
          },
        },
        select: { creatorWallet: true },
        distinct: ["creatorWallet"],
      }),
    ]);

  const purchaseTxHashes = new Set(purchases.map((purchase) => purchase.txHash));
  const settledPaymentFallbacks = settledPayments.filter(
    (payment) => !purchaseTxHashes.has(payment.txHash),
  );
  const totalUnlocks = purchases.length + settledPaymentFallbacks.length;
  const totalUSDCVolume =
    purchases.reduce((sum, purchase) => sum + purchase.amountUSDC, 0) +
    settledPaymentFallbacks.reduce((sum, payment) => sum + payment.amountUSDC, 0);

  return {
    totalResources,
    totalUnlocks,
    totalUSDCVolume,
    totalCreators: creators.length,
  };
}

export async function getCreatorAnalytics(
  wallet: string,
): Promise<CreatorAnalytics> {
  const creatorWallet = normalizeAddress(wallet, "wallet");
  const [resources, settledPayments, x402] = await Promise.all([
    prisma.resource.findMany({
      where: { creatorWallet, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { purchases: true },
    }),
    prisma.payment.findMany({
      where: {
        providerWallet: creatorWallet,
        status: "SETTLED",
      },
      select: {
        resourceId: true,
        payerWallet: true,
        amountUSDC: true,
      },
    }),
    getX402Analytics({ creatorWallet }),
  ]);

  const paymentResourceCounts = new Map<
    string,
    { revenue: number; wallets: Set<string> }
  >();

  for (const payment of settledPayments) {
    const existing = paymentResourceCounts.get(payment.resourceId) ?? {
      revenue: 0,
      wallets: new Set<string>(),
    };
    existing.revenue += payment.amountUSDC;
    existing.wallets.add(payment.payerWallet);
    paymentResourceCounts.set(payment.resourceId, existing);
  }

  const resourcePerformance = resources.map((resource) => {
    const settledFromPurchases = resource.purchases.reduce(
      (sum, purchase) => sum + purchase.amountUSDC,
      0,
    );
    const fallbackSettlement = paymentResourceCounts.get(resource.id);
    const revenue =
      resource.purchases.length > 0
        ? settledFromPurchases * CREATOR_REVENUE_SHARE
        : (fallbackSettlement?.revenue ?? 0) * CREATOR_REVENUE_SHARE;
    const unlockCount =
      resource.purchases.length > 0
        ? resource.purchases.length
        : fallbackSettlement?.wallets.size ?? resource.unlockCount;

    return {
      id: resource.id,
      title: resource.title || resource.name,
      revenue,
      unlockCount,
    };
  });

  const topResource = [...resourcePerformance].sort(
    (a, b) => b.revenue - a.revenue || b.unlockCount - a.unlockCount,
  )[0];

  const revenueEarned = resourcePerformance.reduce(
    (sum, resource) => sum + resource.revenue,
    0,
  );
  const totalUnlocks = resourcePerformance.reduce(
    (sum, resource) => sum + resource.unlockCount,
    0,
  );

  return {
    revenueEarned,
    resourcesPublished: resources.length,
    totalUnlocks,
    topResource: topResource ?? null,
    x402,
  };
}

export async function getRecentProtocolActivity(limit = 12) {
  return mapActivityEntries(await listRecentActivity(limit));
}

export async function getRecentUnlocks(limit = 8): Promise<RecentActivityEntry[]> {
  return mapActivityEntries(
    await listRecentActivityByType(ActivityType.ResourceUnlocked, limit),
  );
}

export async function getRecentPublications(
  limit = 8,
): Promise<RecentActivityEntry[]> {
  return mapActivityEntries(
    await listRecentActivityByType(ActivityType.ResourcePublished, limit),
  );
}

export async function getCreatorProfile(wallet: string): Promise<CreatorProfile> {
  const creatorWallet = normalizeAddress(wallet, "wallet");
  const [user, resources, settledPayments] = await Promise.all([
    prisma.user.findUnique({
      where: { walletAddress: creatorWallet },
      select: { createdAt: true, walletAddress: true },
    }),
    prisma.resource.findMany({
      where: { creatorWallet, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { purchases: true },
    }),
    prisma.payment.findMany({
      where: {
        providerWallet: creatorWallet,
        status: "SETTLED",
      },
      select: {
        resourceId: true,
        payerWallet: true,
        amountUSDC: true,
      },
    }),
  ]);

  const paymentResourceCounts = new Map<
    string,
    { revenue: number; wallets: Set<string> }
  >();

  for (const payment of settledPayments) {
    const existing = paymentResourceCounts.get(payment.resourceId) ?? {
      revenue: 0,
      wallets: new Set<string>(),
    };
    existing.revenue += payment.amountUSDC;
    existing.wallets.add(payment.payerWallet);
    paymentResourceCounts.set(payment.resourceId, existing);
  }

  const resourcesWithRevenue = resources.map((resource) => {
    const settledFromPurchases = resource.purchases.reduce(
      (sum, purchase) => sum + purchase.amountUSDC,
      0,
    );
    const fallbackSettlement = paymentResourceCounts.get(resource.id);
    const revenue =
      resource.purchases.length > 0
        ? settledFromPurchases * CREATOR_REVENUE_SHARE
        : (fallbackSettlement?.revenue ?? 0) * CREATOR_REVENUE_SHARE;
    const unlockCount =
      resource.purchases.length > 0
        ? resource.purchases.length
        : fallbackSettlement?.wallets.size ?? resource.unlockCount;

    return {
      ...serializeResource(resource),
      unlockCount,
      revenue,
    };
  });

  const topResource = [...resourcesWithRevenue].sort(
    (a, b) => b.revenue - a.revenue || b.unlockCount - a.unlockCount,
  )[0];

  const revenueEarned = resourcesWithRevenue.reduce(
    (sum, resource) => sum + resource.revenue,
    0,
  );
  const totalUnlocks = resourcesWithRevenue.reduce(
    (sum, resource) => sum + resource.unlockCount,
    0,
  );

  return {
    wallet: creatorWallet,
    displayName: resolveCreatorDisplayName(resources),
    joinDate: (user?.createdAt ?? resources[0]?.createdAt ?? new Date()).toISOString(),
    resourcesPublished: resources.length,
    revenueEarned,
    unlockCount: totalUnlocks,
    topResource: topResource ?? null,
    resources: resourcesWithRevenue,
  };
}

export async function getCreatedResourceSummaries(
  wallet: string,
): Promise<CreatedResourceSummary[]> {
  const creatorWallet = normalizeAddress(wallet, "wallet");
  const resources = await prisma.resource.findMany({
    where: { creatorWallet, isActive: true },
    orderBy: { createdAt: "desc" },
    include: { purchases: true },
  });

  return resources.map((resource) => ({
    ...serializeResource(resource),
    revenue: resource.purchases.reduce(
      (sum, purchase) => sum + purchase.amountUSDC,
      0,
    ) * CREATOR_REVENUE_SHARE,
  }));
}

function normalizeResourceType(value: string) {
  if (
    value === "API" ||
    value === "CONTENT" ||
    value === "TOOL" ||
    value === "DATASET"
  ) {
    return value;
  }

  return "CONTENT";
}

function resolveCreatorDisplayName(
  resources: Array<{ creatorDisplayName: string | null }>,
) {
  const firstDisplayName = resources.find((resource) =>
    resource.creatorDisplayName?.trim().length,
  )?.creatorDisplayName;

  return normalizeOptionalStoredText(firstDisplayName) ?? null;
}

function normalizeOptionalStoredText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapActivityEntries(
  entries: Array<{
    id: string;
    type: string;
    wallet: string;
    resourceId: string;
    title: string;
    txHash: string | null;
    createdAt: Date;
    resource: {
      type: string;
      category: string;
      title: string;
      name: string;
      creatorWallet: string;
      creatorDisplayName: string | null;
    };
  }>,
): RecentActivityEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    type: normalizeActivityType(entry.type),
    wallet: entry.wallet,
    payerWallet: entry.wallet,
    resourceId: entry.resourceId,
    resourceTitle: entry.title || entry.resource.title || entry.resource.name,
    resourceName: entry.resource.title || entry.resource.name,
    resourceType: normalizeResourceType(entry.resource.type || entry.resource.category),
    creatorWallet: entry.resource.creatorWallet,
    creatorDisplayName: normalizeOptionalStoredText(entry.resource.creatorDisplayName) ?? null,
    txHash: entry.txHash,
    createdAt: entry.createdAt.toISOString(),
  }));
}

function normalizeActivityType(value: string) {
  if (
    value === "RESOURCE_PUBLISHED" ||
    value === "RESOURCE_UNLOCKED" ||
    value === "PROTECTED_RESOURCE_ACCESSED"
  ) {
    return value;
  }

  return "RESOURCE_UNLOCKED";
}
