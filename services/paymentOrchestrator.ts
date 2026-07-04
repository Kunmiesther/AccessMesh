import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { type Address, type Hash } from "viem";
import { buildCircleSendRequirement } from "@/lib/circle";
import { prisma } from "@/lib/prisma";
import {
  InputError,
  normalizeAddress,
  normalizeTxHash,
} from "@/lib/validation";
import { verifySettlement as verifyArcSettlement } from "@/services/arcVerifier";
import {
  LedgerStatus,
  logAccessDenied,
  logAccessGranted,
  logEvent,
  logPaymentConfirmed,
  logPaymentInitiated,
} from "@/services/ledgerService";
import {
  getResourcePaymentParticipants,
  serializeResource,
} from "@/services/resourceService";
import type { PaymentRequirement } from "@/types";

export async function initiatePayment(
  resourceId: string,
  wallet: string,
): Promise<PaymentRequirement> {
  const payerWallet = normalizeAddress(wallet, "wallet");
  const {
    resource,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
  } = await getResourcePaymentParticipants(resourceId);

  await prisma.user.upsert({
    where: { walletAddress: payerWallet },
    create: {
      walletAddress: payerWallet,
      role: "CONSUMER",
    },
    update: {},
  });

  await logPaymentInitiated({
    resourceId,
    payerWallet,
  });

  const existingSettlement = await prisma.payment.findFirst({
    where: {
      resourceId,
      payerWallet,
      status: "SETTLED",
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    resourceId: resource.id,
    amountUSDC: resource.priceUSDC,
    recipientWallet: creatorWallet,
    resource: serializeResource(resource),
    payerWallet,
    providerWallet: creatorWallet,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
    amount: resource.priceUSDC,
    currency: "USDC",
    chain: "Arc Testnet",
    alreadySettled: Boolean(existingSettlement),
    settledTxHash: existingSettlement?.txHash ?? null,
    payment: buildCircleSendRequirement({
      amountUSDC: resource.priceUSDC,
      providerWallet: creatorWallet,
    }),
  };
}

export async function submitTxHash(
  txHashInput: string,
  resourceId: string,
  wallet: string,
) {
  const txHash = normalizeTxHash(txHashInput);
  const payerWallet = normalizeAddress(wallet, "wallet");
  const {
    resource,
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
  } = await getResourcePaymentParticipants(resourceId);

  const payment = await createPendingPayment({
    txHash,
    resourceId,
    payerWallet,
    providerWallet: creatorWallet,
    amountUSDC: resource.priceUSDC,
  });

  await logEvent({
    resourceId,
    payerWallet,
    txHash,
    status: LedgerStatus.PaymentSubmitted,
  });

  const verification = await verifyPaymentSettlement(payment.txHash as Hash);

  return {
    payment: verification.payment,
    verification: verification.result,
  };
}

export async function verifySettlement(txHashInput: string) {
  const verification = await verifyPaymentSettlement(normalizeTxHash(txHashInput));
  return verification.result.settled;
}

export async function verifyPaymentSettlement(txHashInput: string | Hash) {
  const txHash = normalizeTxHash(txHashInput);
  const payment = await prisma.payment.findUnique({
    where: { txHash },
  });

  if (!payment) {
    throw new InputError("payment not found for txHash");
  }

  if (payment.status === "SETTLED") {
    return {
      payment,
      result: {
        status: "SETTLED" as const,
        settled: true,
        reason: "payment already settled",
        txHash: txHash as Hash,
      },
    };
  }

  if (payment.status === "FAILED") {
    return {
      payment,
      result: {
        status: "FAILED" as const,
        settled: false,
        reason: "payment is already marked failed",
        txHash: txHash as Hash,
      },
    };
  }

  await prisma.payment.update({
    where: { txHash },
    data: { status: "CONFIRMING" },
  });

  await logEvent({
    resourceId: payment.resourceId,
    payerWallet: payment.payerWallet,
    txHash,
    status: LedgerStatus.PaymentConfirming,
  });

  const {
    creatorWallet,
    treasuryWallet,
    creatorAmountUSDC,
    treasuryAmountUSDC,
  } = await getResourcePaymentParticipants(payment.resourceId);

  const result = await verifyArcSettlement({
    txHash: txHash as Hash,
    payerWallet: payment.payerWallet as Address,
    transfers: buildPaymentTransfers({
      creatorWallet,
      treasuryWallet,
      creatorAmountUSDC,
      treasuryAmountUSDC,
    }),
  }).catch(async (error: unknown) => {
    const confirmingPayment = await prisma.payment.update({
      where: { txHash },
      data: { status: "CONFIRMING" },
    });

    await logEvent({
      resourceId: payment.resourceId,
      payerWallet: payment.payerWallet,
      txHash,
      status: LedgerStatus.PaymentVerificationUnavailable,
    });

    return {
      payment: confirmingPayment,
      result: {
        status: "CONFIRMING" as const,
        settled: false,
        reason: `Arc verification unavailable: ${getErrorMessage(error)}`,
        txHash: txHash as Hash,
      },
    };
  });

  if ("payment" in result) {
    return result;
  }

  if (result.status === "SETTLED") {
    const settledPayment = await finalizePayment(txHash);
    return {
      payment: settledPayment,
      result,
    };
  }

  if (result.status === "FAILED") {
    const failedPayment = await prisma.payment.update({
      where: { txHash },
      data: { status: "FAILED" },
    });

    await logEvent({
      resourceId: payment.resourceId,
      payerWallet: payment.payerWallet,
      txHash,
      status: LedgerStatus.PaymentFailed,
    });
    await logAccessDenied({
      resourceId: payment.resourceId,
      payerWallet: payment.payerWallet,
      txHash,
    });

    return {
      payment: failedPayment,
      result,
    };
  }

  const pendingPayment = await prisma.payment.update({
    where: { txHash },
    data: { status: result.status },
  });

  return {
    payment: pendingPayment,
    result,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown verification error";
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

export async function finalizePayment(txHashInput: string) {
  const txHash = normalizeTxHash(txHashInput);

  return prisma.$transaction(async (tx: any) => {
    const payment = await tx.payment.findUnique({
      where: { txHash },
    });

    if (!payment) {
      throw new InputError("payment not found for txHash");
    }

    if (payment.status === "SETTLED") {
      return payment;
    }

    if (payment.status === "FAILED") {
      throw new InputError("failed payments cannot be finalized");
    }

    const existingSettledPayment = await tx.payment.findFirst({
      where: {
        resourceId: payment.resourceId,
        payerWallet: payment.payerWallet,
        status: "SETTLED",
        NOT: { txHash },
      },
    });

    if (existingSettledPayment) {
      throw new InputError(
        "resource access is already settled for this wallet with another txHash",
      );
    }

    const settledPayment = await tx.payment.update({
      where: { txHash },
      data: { status: "SETTLED" },
    });

    await tx.accessLog.create({
      data: {
        resourceId: payment.resourceId,
        payerWallet: payment.payerWallet,
        txHash,
        status: LedgerStatus.Unlocked,
      },
    });

    return settledPayment;
  }).then(async (payment: any) => {
    await logPaymentConfirmed({
      resourceId: payment.resourceId,
      payerWallet: payment.payerWallet,
      txHash,
    });
    await logAccessGranted({
      resourceId: payment.resourceId,
      payerWallet: payment.payerWallet,
      txHash,
    });

    return payment;
  });
}

async function createPendingPayment(params: {
  txHash: Hash;
  resourceId: string;
  payerWallet: Address;
  providerWallet: Address;
  amountUSDC: number;
}) {
  const existingSettledPayment = await prisma.payment.findFirst({
    where: {
      resourceId: params.resourceId,
      payerWallet: params.payerWallet,
      status: "SETTLED",
    },
  });

  if (existingSettledPayment) {
    throw new InputError(
      "resource access is already settled for this wallet; double settlement is not allowed",
    );
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
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.payment.findUnique({
        where: { txHash: params.txHash },
      });

      if (!existing) {
        throw error;
      }

      if (
        existing.resourceId !== params.resourceId ||
        existing.payerWallet !== params.payerWallet
      ) {
        throw new InputError(
          "txHash has already been submitted for a different payment",
        );
      }

      return existing;
    }

    throw error;
  }
}
