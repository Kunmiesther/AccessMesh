import { prisma } from "@/lib/prisma";
import { UNKNOWN_WALLET } from "@/lib/validation";

export const LedgerStatus = {
  RequestAttempted: "REQUEST_ATTEMPTED",
  PaymentInitiated: "PAYMENT_INITIATED",
  PaymentSubmitted: "PAYMENT_SUBMITTED",
  PaymentConfirming: "PAYMENT_CONFIRMING",
  PaymentVerificationUnavailable: "PAYMENT_VERIFICATION_UNAVAILABLE",
  PaymentConfirmed: "PAYMENT_CONFIRMED",
  PaymentFailed: "PAYMENT_FAILED",
  AccessGranted: "ACCESS_GRANTED",
  AccessDenied: "ACCESS_DENIED",
  Blocked: "BLOCKED",
  Unlocked: "UNLOCKED",
} as const;

export type LedgerStatusValue =
  (typeof LedgerStatus)[keyof typeof LedgerStatus];

export async function logEvent(params: {
  resourceId: string;
  payerWallet?: string | null;
  status: LedgerStatusValue;
  txHash?: string | null;
}) {
  return prisma.accessLog.create({
    data: {
      resourceId: params.resourceId,
      payerWallet: params.payerWallet || UNKNOWN_WALLET,
      status: params.status,
      txHash: params.txHash ?? null,
    },
  });
}

export async function logRequestAttempted(params: {
  resourceId: string;
  payerWallet?: string | null;
}) {
  return logEvent({
    ...params,
    status: LedgerStatus.RequestAttempted,
  });
}

export async function logPaymentInitiated(params: {
  resourceId: string;
  payerWallet: string;
}) {
  return logEvent({
    ...params,
    status: LedgerStatus.PaymentInitiated,
  });
}

export async function logPaymentConfirmed(params: {
  resourceId: string;
  payerWallet: string;
  txHash: string;
}) {
  return logEvent({
    ...params,
    status: LedgerStatus.PaymentConfirmed,
  });
}

export async function logAccessGranted(params: {
  resourceId: string;
  payerWallet: string;
  txHash?: string | null;
}) {
  return logEvent({
    ...params,
    status: LedgerStatus.AccessGranted,
  });
}

export async function logAccessDenied(params: {
  resourceId: string;
  payerWallet?: string | null;
  txHash?: string | null;
}) {
  return logEvent({
    ...params,
    status: LedgerStatus.AccessDenied,
  });
}

export async function getLedger(params: {
  payerWallet?: string;
  resourceId?: string;
  limit?: number;
}) {
  return prisma.accessLog.findMany({
    where: {
      ...(params.payerWallet ? { payerWallet: params.payerWallet } : {}),
      ...(params.resourceId ? { resourceId: params.resourceId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}
