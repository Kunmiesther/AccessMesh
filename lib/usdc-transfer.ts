"use client";

import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { WaitForUserOperationReceiptTimeoutError } from "viem/account-abstraction";
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
  | "prepareUserOperation"
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

  const chainId = await params.bundlerClient.getChainId();
  if (chainId !== ArcTestnet.chainId) {
    throw new Error(
      `Direct Arc unlock must run on Arc. Active chain id: ${chainId}.`,
    );
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

  const request = {
    account,
    calls,
    parameters: [
      "factory",
      "fees",
      "gas",
      "nonce",
      "signature",
      "authorization",
    ] as const,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
  };

  const preparedRequest = await withTimeout(
    params.bundlerClient.prepareUserOperation(request),
    UNLOCK_OPERATION_TIMEOUT_MS,
    "unlock prepareUserOperation",
  );

  console.info("[unlock] ACTIVE SEND PAYLOAD", {
    accountAddress: account.address,
    chainId,
    callsCount: calls.length,
    firstCallTarget: calls[0]?.to ?? null,
    firstCallCalldataLength:
      Math.max(((calls[0]?.data ?? "0x").length - 2) / 2, 0),
    maxFeePerGasPresent: isPresent(preparedRequest.maxFeePerGas),
    maxPriorityFeePerGasPresent: isPresent(
      preparedRequest.maxPriorityFeePerGas,
    ),
    paymasterPresent: isPresent(
      (preparedRequest as { paymaster?: unknown }).paymaster,
    ),
    paymasterDataPresent: isPresent(
      (preparedRequest as { paymasterData?: unknown }).paymasterData,
    ),
    paymasterVerificationGasLimitPresent: isPresent(
      (preparedRequest as { paymasterVerificationGasLimit?: unknown })
        .paymasterVerificationGasLimit,
    ),
    paymasterPostOpGasLimitPresent: isPresent(
      (preparedRequest as { paymasterPostOpGasLimit?: unknown })
        .paymasterPostOpGasLimit,
    ),
  });

  if (
    isPresent((preparedRequest as { paymaster?: unknown }).paymaster) ||
    isPresent((preparedRequest as { paymasterData?: unknown }).paymasterData)
  ) {
    throw new Error(
      "Direct Arc unlock must not use paymaster sponsorship.",
    );
  }

  const userOpHash = await withTimeout(
    params.bundlerClient.sendUserOperation(request),
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
      receiptBlockNumber: confirmation?.receipt?.blockNumber ?? null,
      receiptGasUsed: confirmation?.receipt?.gasUsed ?? null,
      receiptTransactionHash: confirmation?.receipt?.transactionHash ?? null,
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
    const receipt = await withTimeout(
      requestRawUserOperationReceipt(bundlerClient, userOpHash),
      UNLOCK_LOOKUP_TIMEOUT_MS,
      "unlock getUserOperationReceipt",
    );

    const blockNumber = receipt?.receipt?.blockNumber ?? null;
    const gasUsed = receipt?.receipt?.gasUsed ?? null;
    const transactionHash = receipt?.receipt?.transactionHash ?? null;

    console.info("[unlock] receipt.blockNumber =", blockNumber, {
      userOpHash,
    });
    console.info("[unlock] receipt.gasUsed =", gasUsed, {
      userOpHash,
    });
    console.info("[unlock] receipt.transactionHash =", transactionHash, {
      userOpHash,
    });

    if (
      blockNumber == null ||
      gasUsed == null ||
      transactionHash == null
    ) {
      return null;
    }

    return {
      receipt: {
        blockNumber,
        gasUsed,
        transactionHash,
      },
    };
  } catch (error) {
    console.info("[unlock] receipt lookup returned pending", {
      userOpHash,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

async function tryGetUserOperation(
  bundlerClient: UsdcBundlerClient,
  userOpHash: Hash,
) {
  try {
    const userOperation = await withTimeout(
      requestRawUserOperation(bundlerClient, userOpHash),
      UNLOCK_LOOKUP_TIMEOUT_MS,
      "unlock getUserOperation",
    );

    const blockNumber = userOperation?.blockNumber ?? null;
    const transactionHash = userOperation?.transactionHash ?? null;

    console.info("[unlock] userOp.blockNumber =", blockNumber, {
      userOpHash,
    });
    console.info("[unlock] userOp.transactionHash =", transactionHash, {
      userOpHash,
    });

    if (blockNumber == null || transactionHash == null) {
      return null;
    }

    return {
      blockNumber,
      transactionHash,
    };
  } catch (error) {
    console.info("[unlock] userOp lookup returned pending", {
      userOpHash,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
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

function isPresent(value: unknown) {
  return typeof value !== "undefined" && value !== null;
}

async function requestRawUserOperationReceipt(
  bundlerClient: UsdcBundlerClient,
  userOpHash: Hash,
) {
  const request = (bundlerClient as unknown as {
    request?: (params: {
      method: string;
      params: Array<Hash>;
    }) => Promise<any>;
  }).request;

  if (!request) {
    return null;
  }

  const receipt = await request({
    method: "eth_getUserOperationReceipt",
    params: [userOpHash],
  });

  if (!receipt) {
    return null;
  }

  return receipt as {
    receipt?: {
      blockNumber?: string | null;
      gasUsed?: string | null;
      transactionHash?: Hash | null;
    } | null;
  };
}

async function requestRawUserOperation(
  bundlerClient: UsdcBundlerClient,
  userOpHash: Hash,
) {
  const request = (bundlerClient as unknown as {
    request?: (params: {
      method: string;
      params: Array<Hash>;
    }) => Promise<any>;
  }).request;

  if (!request) {
    return null;
  }

  const result = await request({
    method: "eth_getUserOperationByHash",
    params: [userOpHash],
  });

  if (!result) {
    return null;
  }

  return result as {
    blockNumber?: string | null;
    transactionHash?: Hash | null;
  };
}
