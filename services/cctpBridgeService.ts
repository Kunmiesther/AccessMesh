import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  normalizeTxHash,
  parsePositiveUsdcAmount,
} from "@/lib/validation";
import {
  ActivityType,
  recordActivity,
} from "@/services/activityService";

export type BridgeStatus = "STARTED" | "COMPLETED" | "FAILED";

type BridgeChainInput = {
  name: string;
  chainId: number;
  domain: number;
};

export type BridgeActivitySummary = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  payerWallet: string;
  sourceWallet: string;
  sourceChain: string;
  destinationChain: string;
  amountUSDC: number;
  feeUSDC: number | null;
  totalBurnUSDC: number | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  status: BridgeStatus;
  errorMessage: string | null;
  timestamp: string;
};

export async function recordBridgeStarted(params: {
  resourceId: string;
  payerWallet: string;
  sourceWallet: string;
  sourceChain: BridgeChainInput;
  destinationChain: BridgeChainInput;
  amountUSDC: number;
  feeUSDC?: number | null;
  totalBurnUSDC?: number | null;
  sourceTxHash: string;
}) {
  const payerWallet = normalizeAddress(params.payerWallet, "payerWallet");
  const sourceWallet = normalizeAddress(params.sourceWallet, "sourceWallet");
  const sourceTxHash = normalizeTxHash(params.sourceTxHash);
  const amountUSDC = parsePositiveUsdcAmount(params.amountUSDC);
  const feeUSDC = normalizeOptionalUsdcAmount(params.feeUSDC);
  const totalBurnUSDC = normalizeOptionalUsdcAmount(params.totalBurnUSDC);

  const resource = await prisma.resource.findUnique({
    where: { id: params.resourceId },
    select: { id: true, title: true, name: true },
  });

  if (!resource) {
    throw new InputError("resource not found");
  }

  const existing = await prisma.cctpBridge.findUnique({
    where: { sourceTxHash },
    include: { resource: { select: { title: true, name: true } } },
  });

  if (existing) {
    if (
      existing.resourceId !== resource.id ||
      existing.payerWallet !== payerWallet ||
      existing.sourceWallet !== sourceWallet
    ) {
      throw new InputError("sourceTxHash is already tied to another bridge");
    }

    const updated = await prisma.cctpBridge.update({
      where: { sourceTxHash },
      data: {
        status: "STARTED",
        errorMessage: null,
        feeUSDC,
        totalBurnUSDC,
      },
      include: { resource: { select: { title: true, name: true } } },
    });

    return serializeBridge(updated, updated.resource.title || updated.resource.name);
  }

  const bridge = await prisma.cctpBridge.create({
    data: {
      resourceId: resource.id,
      payerWallet,
      sourceWallet,
      sourceChain: params.sourceChain.name,
      sourceChainId: params.sourceChain.chainId,
      sourceDomain: params.sourceChain.domain,
      destinationChain: params.destinationChain.name,
      destinationChainId: params.destinationChain.chainId,
      destinationDomain: params.destinationChain.domain,
      amountUSDC,
      feeUSDC,
      totalBurnUSDC,
      sourceTxHash,
      status: "STARTED",
    },
  });

  await recordActivity({
    type: ActivityType.BridgeStarted,
    wallet: payerWallet,
    resourceId: resource.id,
    title: resource.title || resource.name,
    txHash: sourceTxHash,
  });

  return serializeBridge(bridge, resource.title || resource.name);
}

export async function recordBridgeCompleted(params: {
  sourceTxHash: string;
  destinationTxHash: string;
  payerWallet: string;
}) {
  const sourceTxHash = normalizeTxHash(params.sourceTxHash);
  const destinationTxHash = normalizeTxHash(params.destinationTxHash);
  const payerWallet = normalizeAddress(params.payerWallet, "payerWallet");

  const bridge = await prisma.cctpBridge.findUnique({
    where: { sourceTxHash },
    include: { resource: { select: { title: true, name: true } } },
  });

  if (!bridge) {
    throw new InputError("bridge record not found");
  }

  if (bridge.payerWallet !== payerWallet) {
    throw new InputError("wallet identity does not match bridge record");
  }

  const updated = await prisma.cctpBridge.update({
    where: { sourceTxHash },
    data: {
      status: "COMPLETED",
      destinationTxHash,
      errorMessage: null,
    },
    include: { resource: { select: { title: true, name: true } } },
  });

  await recordActivity({
    type: ActivityType.BridgeCompleted,
    wallet: updated.payerWallet,
    resourceId: updated.resourceId,
    title: updated.resource.title || updated.resource.name,
    txHash: destinationTxHash,
  });

  return serializeBridge(updated, updated.resource.title || updated.resource.name);
}

export async function recordBridgeFailed(params: {
  sourceTxHash: string;
  payerWallet: string;
  errorMessage: string;
}) {
  const sourceTxHash = normalizeTxHash(params.sourceTxHash);
  const payerWallet = normalizeAddress(params.payerWallet, "payerWallet");
  const errorMessage = normalizeErrorMessage(params.errorMessage);

  const bridge = await prisma.cctpBridge.findUnique({
    where: { sourceTxHash },
    include: { resource: { select: { title: true, name: true } } },
  });

  if (!bridge) {
    throw new InputError("bridge record not found");
  }

  if (bridge.payerWallet !== payerWallet) {
    throw new InputError("wallet identity does not match bridge record");
  }

  const updated = await prisma.cctpBridge.update({
    where: { sourceTxHash },
    data: {
      status: "FAILED",
      errorMessage,
    },
    include: { resource: { select: { title: true, name: true } } },
  });

  await recordActivity({
    type: ActivityType.BridgeFailed,
    wallet: updated.payerWallet,
    resourceId: updated.resourceId,
    title: updated.resource.title || updated.resource.name,
    txHash: sourceTxHash,
  });

  return serializeBridge(updated, updated.resource.title || updated.resource.name);
}

export async function listWalletBridgeActivity(wallet: string, limit = 20) {
  const payerWallet = normalizeAddress(wallet, "wallet");
  const bridges = await prisma.cctpBridge.findMany({
    where: { payerWallet },
    include: { resource: { select: { title: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return bridges.map((bridge) =>
    serializeBridge(bridge, bridge.resource.title || bridge.resource.name),
  );
}

export async function getBridgeAnalytics() {
  const bridges = await prisma.cctpBridge.findMany({
    select: {
      amountUSDC: true,
      status: true,
    },
  });

  return bridges.reduce(
    (stats, bridge) => {
      stats.totalBridgedVolume += bridge.amountUSDC;
      stats.numberOfBridges += 1;

      if (bridge.status === "COMPLETED") {
        stats.successfulBridges += 1;
      }

      if (bridge.status === "FAILED") {
        stats.failedBridges += 1;
      }

      return stats;
    },
    {
      totalBridgedVolume: 0,
      numberOfBridges: 0,
      successfulBridges: 0,
      failedBridges: 0,
    },
  );
}

function normalizeOptionalUsdcAmount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new InputError("USDC amount must be zero or greater");
  }

  return value;
}

function normalizeErrorMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Bridge failed.";
  }

  return trimmed.slice(0, 500);
}

function serializeBridge(
  bridge: {
    id: string;
    resourceId: string;
    payerWallet: string;
    sourceWallet: string;
    sourceChain: string;
    destinationChain: string;
    amountUSDC: number;
    feeUSDC: number | null;
    totalBurnUSDC: number | null;
    sourceTxHash: string | null;
    destinationTxHash: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
  },
  resourceTitle: string,
): BridgeActivitySummary {
  return {
    id: bridge.id,
    resourceId: bridge.resourceId,
    resourceTitle,
    payerWallet: bridge.payerWallet,
    sourceWallet: bridge.sourceWallet,
    sourceChain: bridge.sourceChain,
    destinationChain: bridge.destinationChain,
    amountUSDC: bridge.amountUSDC,
    feeUSDC: bridge.feeUSDC,
    totalBurnUSDC: bridge.totalBurnUSDC,
    sourceTxHash: bridge.sourceTxHash,
    destinationTxHash: bridge.destinationTxHash,
    status: normalizeBridgeStatus(bridge.status),
    errorMessage: bridge.errorMessage,
    timestamp: bridge.createdAt.toISOString(),
  };
}

function normalizeBridgeStatus(value: string): BridgeStatus {
  if (value === "COMPLETED" || value === "FAILED") {
    return value;
  }

  return "STARTED";
}
