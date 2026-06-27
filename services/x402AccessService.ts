import type { Resource } from "@prisma/client";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_WALLET } from "@/lib/validation";

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
