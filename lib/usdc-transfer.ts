"use client";

import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import {
  UserOperationNotFoundError,
  UserOperationReceiptNotFoundError,
  WaitForUserOperationReceiptTimeoutError,
} from "viem/account-abstraction";
import { getArcUserOperationGasFees } from "@/lib/arc-gas";
import type { ModularWalletSession } from "@/lib/modular-wallet";

export const USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS = 300_000;

export type UsdcPaymentConfirmation =
  | {
      status: "confirmed";
      userOpHash: Hash;
      transactionHash: Hash;
    }
  | {
      status: "pending";
      userOpHash: Hash;
    };

export async function submitUsdcPayment(params: {
  bundlerClient: ModularWalletSession["bundlerClient"];
  transfers: Array<{
    recipientWallet: Address;
    amountUSDC: number;
  }>;
}): Promise<Hash> {
  const calls = params.transfers
    .filter((transfer) => transfer.amountUSDC > 0)
    .map((transfer) =>
      buildTransferCall(transfer.recipientWallet, transfer.amountUSDC),
    );

  if (calls.length === 0) {
    throw new Error("USDC payment requires at least one positive transfer.");
  }

  const gasFees = await getArcUserOperationGasFees();
  return params.bundlerClient.sendUserOperation({
    calls,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
  });
}

export async function confirmUsdcPayment(params: {
  bundlerClient: ModularWalletSession["bundlerClient"];
  userOpHash: Hash;
  timeoutMs?: number;
}): Promise<UsdcPaymentConfirmation> {
  const timeoutMs = params.timeoutMs ?? USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS;

  try {
    const receipt = await params.bundlerClient.waitForUserOperationReceipt({
      hash: params.userOpHash,
      timeout: timeoutMs,
    });

    if (!receipt.success) {
      throw new Error(receipt.reason ?? "USDC payment user operation reverted.");
    }

    return {
      status: "confirmed",
      userOpHash: params.userOpHash,
      transactionHash: receipt.receipt.transactionHash,
    };
  } catch (error) {
    if (!isUserOperationTimeoutError(error)) {
      throw error;
    }

    const confirmation = await tryGetUserOperationReceipt(
      params.bundlerClient,
      params.userOpHash,
    );

    if (confirmation) {
      return {
        status: "confirmed",
        userOpHash: params.userOpHash,
        transactionHash: confirmation.receipt.transactionHash,
      };
    }

    const includedOperation = await tryGetUserOperation(
      params.bundlerClient,
      params.userOpHash,
    );

    if (includedOperation) {
      return {
        status: "confirmed",
        userOpHash: params.userOpHash,
        transactionHash: includedOperation.transactionHash,
      };
    }

    return {
      status: "pending",
      userOpHash: params.userOpHash,
    };
  }
}

export async function executeUsdcPayment(params: {
  bundlerClient: ModularWalletSession["bundlerClient"];
  transfers: Array<{
    recipientWallet: Address;
    amountUSDC: number;
  }>;
}): Promise<Hash> {
  const userOpHash = await submitUsdcPayment(params);
  const confirmation = await confirmUsdcPayment({
    bundlerClient: params.bundlerClient,
    userOpHash,
  });

  if (confirmation.status !== "confirmed") {
    throw new Error("Transaction submitted but still pending.");
  }

  return confirmation.transactionHash;
}

function buildTransferCall(recipientWallet: Address, amountUSDC: number) {
  return {
    to: ArcTestnet.usdcAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientWallet, parseUnits(amountUSDC.toString(), 6)],
    }),
    value: BigInt(0),
  };
}

async function tryGetUserOperationReceipt(
  bundlerClient: ModularWalletSession["bundlerClient"],
  userOpHash: Hash,
) {
  try {
    return await bundlerClient.getUserOperationReceipt({
      hash: userOpHash,
    });
  } catch (error) {
    if (error instanceof UserOperationReceiptNotFoundError) {
      return null;
    }

    throw error;
  }
}

async function tryGetUserOperation(
  bundlerClient: ModularWalletSession["bundlerClient"],
  userOpHash: Hash,
) {
  try {
    return await bundlerClient.getUserOperation({
      hash: userOpHash,
    });
  } catch (error) {
    if (error instanceof UserOperationNotFoundError) {
      return null;
    }

    throw error;
  }
}

function isUserOperationTimeoutError(error: unknown) {
  return error instanceof WaitForUserOperationReceiptTimeoutError;
}
