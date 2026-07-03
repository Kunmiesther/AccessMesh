import { createHmac, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { type Address, type Hash } from "viem";
import { buildCircleSendRequirement } from "@/lib/circle";
import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  normalizeTxHash,
} from "@/lib/validation";
import { ActivityType } from "@/services/activityService";
import { verifySettlement } from "@/services/arcVerifier";
import { LedgerStatus, logAccessDenied, logEvent } from "@/services/ledgerService";
import {
  getResourcePaymentParticipants,
  serializeResource,
} from "@/services/resourceService";
import type { PaymentIntent, UnlockResponse, UnlockVerification } from "@/types";

const INTENT_TTL_MS =
  Number(process.env.ACCESS_INTENT_TTL_SECONDS ?? 600) * 1000;
const TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 3600);
const UNLOCK_VERIFY_TIMEOUT_MS = 90_000;

type AccessIntent = {
  accessId: string;
  resourceId: string;
  payerWallet: Address;
  amountUSDC: number;
  recipientWallet: Address;
  creatorWallet: Address;
  treasuryWallet: Address;
  creatorAmountUSDC: number;
  treasuryAmountUSDC: number;
  expiresAt: string;
  createdAt: string;
};

type GlobalAccessState = {
  accessMeshIntents?: Map<string, AccessIntent>;
  accessMeshTokenSecret?: string;
};

const globalAccessState = globalThis as typeof globalThis & GlobalAccessState;
const accessIntents =
  globalAccessState.accessMeshIntents ?? new Map<string, AccessIntent>();

if (!globalAccessState.accessMeshIntents) {
  globalAccessState.accessMeshIntents = accessIntents;
}

export async function createAccessPaymentIntent(params: {
  resourceId: string;
  payerWallet: string;
  fallbackRecipientWallet?: string | null;
  fallbackAmountUSDC?: string | number | null;
}): Promise<PaymentIntent> {
  const payerWallet = normalizeAddress(params.payerWallet, "wallet");
  const paymentFields = await resolvePaymentFields(params.resourceId);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + INTENT_TTL_MS);
  const accessId = await createIntentAccessId({
    resourceId: params.resourceId,
    payerWallet,
  });

  const intent: AccessIntent = {
    accessId,
    resourceId: params.resourceId,
    payerWallet,
    amountUSDC: paymentFields.amountUSDC,
    recipientWallet: paymentFields.recipientWallet,
    creatorWallet: paymentFields.creatorWallet,
    treasuryWallet: paymentFields.treasuryWallet,
    creatorAmountUSDC: paymentFields.creatorAmountUSDC,
    treasuryAmountUSDC: paymentFields.treasuryAmountUSDC,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  accessIntents.set(accessId, intent);

  await logEvent({
    resourceId: params.resourceId,
    payerWallet,
    status: LedgerStatus.PaymentInitiated,
  });

  return {
    accessId,
    amountUSDC: paymentFields.amountUSDC,
    recipientWallet: paymentFields.recipientWallet,
    creatorWallet: paymentFields.creatorWallet,
    treasuryWallet: paymentFields.treasuryWallet,
    creatorAmountUSDC: paymentFields.creatorAmountUSDC,
    treasuryAmountUSDC: paymentFields.treasuryAmountUSDC,
    expiresAt: intent.expiresAt,
    payerWallet,
    resource: serializeResource(paymentFields.resource),
    payment: buildCircleSendRequirement({
      amountUSDC: paymentFields.amountUSDC,
      providerWallet: paymentFields.recipientWallet,
    }),
  };
}

export async function unlockAccess(params: {
  accessId: string;
  txHash: string;
  payerWallet?: string | null;
}): Promise<
  UnlockResponse & {
    accessToken?: string;
    tokenType?: "Bearer";
  }
> {
  const accessId = requireString(params.accessId, "accessId");
  const txHash = normalizeTxHash(params.txHash);
  const intent = await resolveAccessIntent(accessId);

  assertIntentActive(intent);
  assertWalletMatchesIntent(params.payerWallet, intent.payerWallet);

  const payment = await reservePayment({
    txHash,
    resourceId: intent.resourceId,
    payerWallet: intent.payerWallet,
    providerWallet: intent.recipientWallet,
    amountUSDC: intent.amountUSDC,
  });

  await logEvent({
    resourceId: intent.resourceId,
    payerWallet: intent.payerWallet,
    txHash,
    status: LedgerStatus.PaymentSubmitted,
  });

  const verification = await withTimeout(
    verifySettlement({
      txHash,
      payerWallet: intent.payerWallet,
      transfers: buildPaymentTransfers({
        creatorWallet: intent.creatorWallet,
        treasuryWallet: intent.treasuryWallet,
        creatorAmountUSDC: intent.creatorAmountUSDC,
        treasuryAmountUSDC: intent.treasuryAmountUSDC,
      }),
    }),
    UNLOCK_VERIFY_TIMEOUT_MS,
    "unlock verifySettlement",
  ).catch(async (error: unknown) => {
    await prisma.payment.update({
      where: { txHash },
      data: { status: "CONFIRMING" },
    });
    await logEvent({
      resourceId: intent.resourceId,
      payerWallet: intent.payerWallet,
      txHash,
      status: LedgerStatus.PaymentVerificationUnavailable,
    });

    return {
      status: "CONFIRMING" as const,
      settled: false,
      reason: `Arc verification unavailable: ${getErrorMessage(error)}`,
      txHash,
    };
  });

  const unlockVerification = normalizeUnlockVerification(verification);

  if (unlockVerification.status !== "SETTLED") {
    const status = unlockVerification.status === "FAILED" ? "FAILED" : "CONFIRMING";
    await prisma.payment.update({
      where: { txHash },
      data: { status },
    });

    if (status === "FAILED") {
      await logEvent({
        resourceId: intent.resourceId,
        payerWallet: intent.payerWallet,
        txHash,
        status: LedgerStatus.PaymentFailed,
      });
      await logAccessDenied({
        resourceId: intent.resourceId,
        payerWallet: intent.payerWallet,
        txHash,
      });
    }

    return {
      ok: false,
      access: "LOCKED",
      payment: {
        id: payment.id,
        status,
        txHash,
      },
      verification: unlockVerification,
    };
  }

  console.info("UNLOCK STEP 7 Payment verified", {
    resourceId: intent.resourceId,
    wallet: intent.payerWallet,
    txHash,
  });

  const settlement = await settlePayment({
    txHash,
    resourceId: intent.resourceId,
    payerWallet: intent.payerWallet,
  });

  console.info("UNLOCK STEP 8 Purchase recorded", {
    resourceId: intent.resourceId,
    wallet: intent.payerWallet,
    txHash,
    purchaseId: settlement.purchase.id,
  });

  const token = signAccessToken({
    accessId,
    resourceId: intent.resourceId,
    payerWallet: intent.payerWallet,
    txHash,
  });

  return {
    ok: true,
    access: "UNLOCKED",
    accessToken: token.value,
    tokenType: "Bearer",
    expiresAt: token.expiresAt,
    resourceId: intent.resourceId,
    resource: settlement.resource,
    txHash,
    purchase: settlement.purchase,
    verification: unlockVerification,
  };
}

async function createIntentAccessId(params: {
  resourceId: string;
  payerWallet: Address;
}) {
  try {
    const log = await prisma.accessLog.create({
      data: {
        resourceId: params.resourceId,
        payerWallet: params.payerWallet,
        status: "PAYMENT_INTENT",
      },
    });

    return log.id;
  } catch {
    return `mem_${randomBytes(16).toString("hex")}`;
  }
}

async function resolveAccessIntent(accessId: string): Promise<AccessIntent> {
  const fallback = accessIntents.get(accessId);

  const accessLog = await prisma.accessLog
    .findUnique({ where: { id: accessId } })
    .catch(() => null);

  if (!accessLog) {
    if (fallback) {
      return fallback;
    }

    throw new InputError("accessId was not found");
  }

  const paymentFields = await resolvePaymentFields(accessLog.resourceId);
  const createdAt = accessLog.createdAt;

  return {
    accessId,
    resourceId: accessLog.resourceId,
    payerWallet: normalizeAddress(
      accessLog.payerWallet || fallback?.payerWallet,
      "payerWallet",
    ),
    amountUSDC: paymentFields.amountUSDC,
    recipientWallet: paymentFields.recipientWallet,
    creatorWallet: paymentFields.creatorWallet,
    treasuryWallet: paymentFields.treasuryWallet,
    creatorAmountUSDC: paymentFields.creatorAmountUSDC,
    treasuryAmountUSDC: paymentFields.treasuryAmountUSDC,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + INTENT_TTL_MS).toISOString(),
  };
}

async function resolvePaymentFields(resourceId: string) {
  const {
    resource,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
  } = await getResourcePaymentParticipants(resourceId);

  return {
    resource,
    amountUSDC: resource.priceUSDC,
    recipientWallet: creatorWallet,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
  };
}

async function reservePayment(params: {
  txHash: Hash;
  resourceId: string;
  payerWallet: Address;
  providerWallet: Address;
  amountUSDC: number;
}) {
  const existingByHash = await prisma.payment.findUnique({
    where: { txHash: params.txHash },
  });

  if (existingByHash) {
    if (
      existingByHash.resourceId !== params.resourceId ||
      existingByHash.payerWallet !== params.payerWallet ||
      existingByHash.providerWallet !== params.providerWallet
    ) {
      throw new InputError("txHash is already tied to another access request");
    }

    return existingByHash;
  }

  const existingSettlement = await prisma.payment.findFirst({
    where: {
      resourceId: params.resourceId,
      payerWallet: params.payerWallet,
      status: "SETTLED",
    },
  });

  if (existingSettlement) {
    throw new InputError("access is already settled for this wallet/resource");
  }

  try {
    return await prisma.payment.create({
      data: {
        resourceId: params.resourceId,
        payerWallet: params.payerWallet,
        providerWallet: params.providerWallet,
        amountUSDC: params.amountUSDC,
        txHash: params.txHash,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new InputError("txHash has already been submitted");
    }

    throw error;
  }
}

async function settlePayment(params: {
  txHash: Hash;
  resourceId: string;
  payerWallet: Address;
}) {
  const settlement = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { txHash: params.txHash },
    });

    if (!payment) {
      throw new InputError("payment not found for txHash");
    }

    const resource = await tx.resource.findUnique({
      where: { id: params.resourceId },
    });

    if (!resource || !resource.isActive) {
      throw new InputError("resource not found or inactive");
    }

    const duplicateSettlement = await tx.payment.findFirst({
      where: {
        resourceId: params.resourceId,
        payerWallet: params.payerWallet,
        status: "SETTLED",
        NOT: { txHash: params.txHash },
      },
    });

    if (duplicateSettlement) {
      throw new InputError("access is already settled with another txHash");
    }

    const settledPayment = await tx.payment.update({
      where: { txHash: params.txHash },
      data: { status: "SETTLED" },
    });

    const existingPurchase = await tx.purchase.findUnique({
      where: {
        resourceId_buyerWallet: {
          resourceId: params.resourceId,
          buyerWallet: params.payerWallet,
        },
      },
    });

    const purchase =
      existingPurchase ??
      (await tx.purchase.create({
        data: {
          resourceId: params.resourceId,
          buyerWallet: params.payerWallet,
          creatorWallet: payment.providerWallet,
          amountUSDC: payment.amountUSDC,
          txHash: params.txHash,
        },
      }));

    const settledResource = existingPurchase
      ? resource
      : await tx.resource.update({
        where: { id: params.resourceId },
        data: { unlockCount: { increment: 1 } },
      });

    if (!existingPurchase) {
      await tx.activityEvent.create({
        data: {
          type: ActivityType.ResourceUnlocked,
          wallet: params.payerWallet,
          resourceId: params.resourceId,
          title: resource.title || resource.name,
          txHash: params.txHash,
        },
      });
    }

    await tx.accessLog.create({
      data: {
        resourceId: params.resourceId,
        payerWallet: params.payerWallet,
        txHash: params.txHash,
        status: LedgerStatus.Unlocked,
      },
    });

    return {
      payment: settledPayment,
      resource: serializeResource(settledResource),
      purchase: {
        id: purchase.id,
        resourceId: purchase.resourceId,
        resourceTitle: resource.title || resource.name,
        buyerWallet: purchase.buyerWallet,
        creatorWallet: purchase.creatorWallet,
        creatorDisplayName: normalizeOptionalStoredText(resource.creatorDisplayName) ?? null,
        amountUSDC: purchase.amountUSDC,
        txHash: purchase.txHash,
        timestamp: purchase.createdAt.toISOString(),
      },
    };
  });

  await logEvent({
    resourceId: params.resourceId,
    payerWallet: params.payerWallet,
    txHash: params.txHash,
    status: LedgerStatus.PaymentConfirmed,
  });

  await logEvent({
    resourceId: params.resourceId,
    payerWallet: params.payerWallet,
    txHash: params.txHash,
    status: LedgerStatus.AccessGranted,
  });

  return settlement;
}

function assertIntentActive(intent: AccessIntent) {
  if (Date.now() > new Date(intent.expiresAt).getTime()) {
    throw new InputError("accessId has expired");
  }
}

function assertWalletMatchesIntent(
  walletInput: string | null | undefined,
  intentWallet: Address,
) {
  if (!walletInput) {
    throw new InputError("wallet identity is required");
  }

  const connectedWallet = normalizeAddress(walletInput, "wallet");
  if (connectedWallet !== intentWallet) {
    throw new InputError("wallet identity does not match access intent");
  }
}

function signAccessToken(params: {
  accessId: string;
  resourceId: string;
  payerWallet: Address;
  txHash: Hash;
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SECONDS;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: "accessmesh",
    aud: "accessmesh-resource",
    sub: params.payerWallet,
    accessId: params.accessId,
    resourceId: params.resourceId,
    txHash: params.txHash,
    iat: now,
    exp,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac("sha256", getAccessTokenSecret())
    .update(unsigned)
    .digest("base64url");

  return {
    value: `${unsigned}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function getAccessTokenSecret() {
  if (process.env.ACCESS_TOKEN_SECRET) {
    return process.env.ACCESS_TOKEN_SECRET;
  }

  if (process.env.CIRCLE_APP_KEY) {
    return process.env.CIRCLE_APP_KEY;
  }

  globalAccessState.accessMeshTokenSecret ??= randomBytes(32).toString("hex");
  return globalAccessState.accessMeshTokenSecret;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InputError(`${field} is required`);
  }

  return value.trim();
}

function normalizeUnlockVerification(
  verification: Awaited<ReturnType<typeof verifySettlement>>,
): UnlockVerification {
  const status =
    verification.status === "PENDING" ? "CONFIRMING" : verification.status;

  if (verification.status === "PENDING") {
    return {
      status,
      settled: verification.settled,
      reason: verification.reason,
      txHash: verification.txHash,
    };
  }

  return {
    status,
    settled: verification.settled,
    reason: verification.reason,
    txHash: verification.txHash,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown verification error";
}

function normalizeOptionalStoredText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildPaymentTransfers(params: {
  creatorWallet: Address;
  treasuryWallet: Address;
  creatorAmountUSDC: number;
  treasuryAmountUSDC: number;
}) {
  const transfers = [
    {
      recipientWallet: params.creatorWallet,
      amountUSDC: params.creatorAmountUSDC,
    },
  ];

  if (params.treasuryAmountUSDC > 0) {
    transfers.push({
      recipientWallet: params.treasuryWallet,
      amountUSDC: params.treasuryAmountUSDC,
    });
  }

  return transfers;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
