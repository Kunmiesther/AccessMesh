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

export const USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS = 120_000;
const UNLOCK_OPERATION_TIMEOUT_MS = 120_000;
const UNLOCK_LOOKUP_TIMEOUT_MS = 15_000;

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

export type UsdcBundlerClient = Pick<
  NonNullable<ModularWalletSession["bundlerClient"]>,
  | "account"
  | "getChainId"
  | "sendUserOperation"
  | "waitForUserOperationReceipt"
  | "getUserOperationReceipt"
  | "getUserOperation"
>;

export async function submitUsdcPayment(params: {
  bundlerClient: UsdcBundlerClient;
  transfers: Array<{
    recipientWallet: Address;
    amountUSDC: number;
  }>;
  logPrefix?: string;
}): Promise<Hash> {
  const calls = params.transfers
    .filter((transfer) => transfer.amountUSDC > 0)
    .map((transfer) =>
      buildTransferCall(transfer.recipientWallet, transfer.amountUSDC),
    );

  if (calls.length === 0) {
    throw new Error("USDC payment requires at least one positive transfer.");
  }

  const account = params.bundlerClient.account;
  if (!account) {
    throw new Error("Publish smart account is unavailable.");
  }

  const gasFees = await withTimeout(
    getArcUserOperationGasFees(),
    UNLOCK_OPERATION_TIMEOUT_MS,
    "unlock gas estimation",
  );

  if (params.logPrefix === "publish") {
    const chainId = await params.bundlerClient.getChainId();
    console.info("[publish] ACTIVE SEND PAYLOAD", {
      accountPresent: Boolean(account),
      accountAddress: account.address,
      chainId,
      callsLength: calls.length,
      callTarget: calls[0]?.to,
      calldataLength: calls[0]?.data?.length ?? 0,
      maxFeePerGasPresent: Boolean(gasFees.maxFeePerGas),
      maxPriorityFeePerGasPresent: Boolean(gasFees.maxPriorityFeePerGas),
    });
  }

  console.info("UNLOCK STEP 4 Sending unlock UserOperation");

  const userOpHash = await withTimeout(
    params.bundlerClient.sendUserOperation({
      account,
      calls,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
    }),
    UNLOCK_OPERATION_TIMEOUT_MS,
    "unlock sendUserOperation",
  );

  console.info("UNLOCK STEP 5 UserOperation hash received", userOpHash);

  return userOpHash;
}

export async function confirmUsdcPayment(params: {
  bundlerClient: UsdcBundlerClient;
  userOpHash: Hash;
  timeoutMs?: number;
}): Promise<UsdcPaymentConfirmation> {
  const timeoutMs = params.timeoutMs ?? USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS;

  try {
    console.info("UNLOCK STEP 6 Waiting for confirmation");
    const receipt = await withTimeout(
      params.bundlerClient.waitForUserOperationReceipt({
        hash: params.userOpHash,
        timeout: timeoutMs,
      }),
      timeoutMs,
      "unlock waitForUserOperationReceipt",
    );

    if (!receipt.success) {
      throw new Error(receipt.reason ?? "USDC payment user operation reverted.");
    }

    return {
      status: "confirmed",
      userOpHash: params.userOpHash,
      transactionHash: receipt.receipt.transactionHash,
    };
  } catch (error) {
    if (!isUserOperationTimeoutError(error) && !isUnlockTimeoutError(error)) {
      throw error;
    }

    const confirmation = await tryGetUserOperationReceipt(
      params.bundlerClient,
      params.userOpHash,
    );

    console.info("UNLOCK STEP 6 Receipt lookup after timeout", {
      userOpHash: params.userOpHash,
      getUserOperationReceipt: Boolean(confirmation),
    });

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

    console.info("UNLOCK STEP 6 Operation lookup after timeout", {
      userOpHash: params.userOpHash,
      getUserOperation: Boolean(includedOperation),
    });

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
  bundlerClient: UsdcBundlerClient,
  userOpHash: Hash,
) {
  try {
    return await withTimeout(
      bundlerClient.getUserOperationReceipt({
        hash: userOpHash,
      }),
      UNLOCK_LOOKUP_TIMEOUT_MS,
      "unlock getUserOperationReceipt",
    );
  } catch (error) {
    if (
      error instanceof UserOperationReceiptNotFoundError ||
      isUnlockTimeoutError(error)
    ) {
      return null;
    }

    throw error;
  }
}

async function tryGetUserOperation(
  bundlerClient: UsdcBundlerClient,
  userOpHash: Hash,
) {
  try {
    return await withTimeout(
      bundlerClient.getUserOperation({
        hash: userOpHash,
      }),
      UNLOCK_LOOKUP_TIMEOUT_MS,
      "unlock getUserOperation",
    );
  } catch (error) {
    if (
      error instanceof UserOperationNotFoundError ||
      isUnlockTimeoutError(error)
    ) {
      return null;
    }

    throw error;
  }
}

function isUserOperationTimeoutError(error: unknown) {
  return error instanceof WaitForUserOperationReceiptTimeoutError;
}

function isUnlockTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      /timed out/i.test(error.message))
  );
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
