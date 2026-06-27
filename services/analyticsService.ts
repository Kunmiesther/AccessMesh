import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/validation";
import { getX402Analytics } from "@/services/x402AccessService";
import type { CreatedResourceSummary, CreatorAnalytics, ProtocolStats } from "@/types";

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
        ? settledFromPurchases
        : fallbackSettlement?.revenue ?? 0;
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
    id: resource.id,
    creatorWallet: resource.creatorWallet,
    title: resource.title || resource.name,
    name: resource.name,
    description: resource.description,
    category: normalizeResourceType(resource.category),
    type: normalizeResourceType(resource.type),
    priceUSDC: resource.priceUSDC,
    resourceUrl: resource.resourceUrl || resource.endpoint,
    endpoint: resource.endpoint,
    coverImage: resource.coverImage,
    tags: parseStoredTags(resource.tags),
    unlockCount: resource.unlockCount,
    isActive: resource.isActive,
    createdAt: resource.createdAt.toISOString(),
    revenue: resource.purchases.reduce(
      (sum, purchase) => sum + purchase.amountUSDC,
      0,
    ),
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
