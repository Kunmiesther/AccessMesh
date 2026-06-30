import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/validation";
import type { PurchaseProof } from "@/types";

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

function normalizeOptionalStoredText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
