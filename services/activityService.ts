import { prisma } from "@/lib/prisma";
import { UNKNOWN_WALLET } from "@/lib/validation";

export const ActivityType = {
  ResourcePublished: "RESOURCE_PUBLISHED",
  ResourceUnlocked: "RESOURCE_UNLOCKED",
  ProtectedResourceAccessed: "PROTECTED_RESOURCE_ACCESSED",
} as const;

export type ActivityTypeValue = (typeof ActivityType)[keyof typeof ActivityType];

export async function recordActivity(params: {
  type: ActivityTypeValue;
  wallet?: string | null;
  resourceId: string;
  title: string;
  txHash?: string | null;
}) {
  return prisma.activityEvent.create({
    data: {
      type: params.type,
      wallet: params.wallet || UNKNOWN_WALLET,
      resourceId: params.resourceId,
      title: params.title,
      txHash: params.txHash ?? null,
    },
  });
}

export async function listRecentActivity(limit = 12) {
  return prisma.activityEvent.findMany({
    include: { resource: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
