"use client";

import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  toModularTransport,
} from "@circle-fin/modular-wallets-core";
import { createBundlerClient } from "viem/account-abstraction";
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { WaitForUserOperationReceiptTimeoutError } from "viem/account-abstraction";
import { getArcUserOperationGasFees } from "@/lib/arc-gas";
import type { ModularWalletSession } from "@/lib/modular-wallet";
import { arcTestnet } from "viem/chains";

export const USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS = 120_000;
const UNLOCK_OPERATION_TIMEOUT_MS = 120_000;
const UNLOCK_LOOKUP_TIMEOUT_MS = 15_000;
const MODULAR_WALLET_CHAIN_PATH = "arcTestnet";

export type UsdcPaymentConfirmation =
  {
    status: "confirmed";
    userOpHash: Hash;
    transactionHash: Hash;
  };

export type UsdcBundlerClient = Pick<
  NonNullable<ModularWalletSession["bundlerClient"]>,
  | "account"
  | "chain"
  | "client"
  | "transport"
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

  const directBundlerClient = createDirectUnlockBundlerClient(
    account,
  );

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

  console.info("UNLOCK STEP 4 Building unlock user operation");
  const preparedRequest = await withTimeout(
    directBundlerClient.prepareUserOperation(request),
    UNLOCK_OPERATION_TIMEOUT_MS,
    "unlock prepareUserOperation",
  );

  const sendRequest = stripUnlockPaymasterFields(preparedRequest);

  console.info("[unlock] ACTIVE SEND PAYLOAD", {
    accountAddress: account.address,
    chainId,
    ...summarizeUnlockUserOperationRequest({
      chainId,
      request: sendRequest,
      calls,
      accountAddress: account.address,
    }),
  });

  if (hasUnlockPaymasterFields(sendRequest)) {
    throw new Error(
      "Direct Arc unlock must not use paymaster sponsorship.",
    );
  }

  console.info("UNLOCK STEP 5 Sending unlock user operation");

  let userOpHash: Hash;
  try {
    userOpHash = await withTimeout(
      directBundlerClient.sendUserOperation(sendRequest as never),
      UNLOCK_OPERATION_TIMEOUT_MS,
      "unlock sendUserOperation",
    );
  } catch (error) {
    console.error(
      "[unlock] sendUserOperation request",
      summarizeUnlockUserOperationRequest({
        chainId,
        request: sendRequest,
        calls,
        accountAddress: account.address,
      }),
    );
    if (isMaxPendingOperationsError(error)) {
      throw new Error(
        "Your account has too many pending unlock operations. Wait for them to clear, then retry.",
      );
    }
    throw error;
  }

  console.info("UNLOCK STEP 6 User operation hash received", userOpHash);

  return userOpHash;
}

export async function confirmUsdcPayment(params: {
  bundlerClient: UsdcBundlerClient;
  userOpHash: Hash;
  timeoutMs?: number;
}): Promise<UsdcPaymentConfirmation> {
  const timeoutMs = params.timeoutMs ?? USDC_PAYMENT_CONFIRMATION_TIMEOUT_MS;

  try {
    console.info("UNLOCK STEP 7 Waiting for confirmation");
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

    console.info("UNLOCK STEP 8 Confirmed on-chain", {
      userOpHash: params.userOpHash,
      transactionHash: receipt.receipt.transactionHash,
    });

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

    console.info("UNLOCK STEP 7 Receipt lookup after timeout", {
      userOpHash: params.userOpHash,
      getUserOperationReceipt: Boolean(confirmation),
      receiptBlockNumber: confirmation?.receipt?.blockNumber ?? null,
      receiptGasUsed: confirmation?.receipt?.gasUsed ?? null,
      receiptTransactionHash: confirmation?.receipt?.transactionHash ?? null,
    });

    if (confirmation) {
      console.info("UNLOCK STEP 8 Confirmed on-chain", {
        userOpHash: params.userOpHash,
        transactionHash: confirmation.receipt.transactionHash,
      });
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

    console.info("UNLOCK STEP 7 Operation lookup after timeout", {
      userOpHash: params.userOpHash,
      getUserOperation: Boolean(includedOperation),
    });

    if (includedOperation) {
      console.info("UNLOCK STEP 8 Confirmed on-chain", {
        userOpHash: params.userOpHash,
        transactionHash: includedOperation.transactionHash,
      });
      return {
        status: "confirmed",
        userOpHash: params.userOpHash,
        transactionHash: includedOperation.transactionHash,
      };
    }

    throw new Error(
      "Unlock confirmation was not found after timeout. Please wait for pending operations to clear, then retry.",
    );
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

function createDirectUnlockBundlerClient(
  account: NonNullable<UsdcBundlerClient["account"]>,
) {
  const { clientKey, clientUrl } = getClientEnv();
  const modularTransport = toModularTransport(
    getChainClientUrl(clientUrl),
    clientKey,
  );
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: modularTransport,
  });

  return createBundlerClient({
    account,
    chain: arcTestnet,
    client: publicClient,
    transport: modularTransport,
  });
}

function getClientEnv() {
  const clientKey = process.env.NEXT_PUBLIC_CLIENT_KEY;
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL;

  if (!clientKey || !clientUrl) {
    throw new Error("Missing NEXT_PUBLIC_CLIENT_KEY or NEXT_PUBLIC_CLIENT_URL.");
  }

  return { clientKey, clientUrl };
}

function getChainClientUrl(clientUrl: string) {
  return `${clientUrl.replace(/\/+$/, "")}/${MODULAR_WALLET_CHAIN_PATH}`;
}

function stripUnlockPaymasterFields<T extends Record<string, unknown>>(request: T) {
  const {
    paymaster: _paymaster,
    paymasterData: _paymasterData,
    paymasterVerificationGasLimit: _paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: _paymasterPostOpGasLimit,
    ...sanitizedRequest
  } = request;

  return sanitizedRequest;
}

function hasUnlockPaymasterFields(request: Record<string, unknown>) {
  return (
    isPresent(request.paymaster) ||
    isPresent(request.paymasterData) ||
    isPresent(request.paymasterVerificationGasLimit) ||
    isPresent(request.paymasterPostOpGasLimit)
  );
}

function isMaxPendingOperationsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /max operations/i.test(message) || /pending unlock operations/i.test(message);
}

function summarizeUnlockUserOperationRequest(params: {
  chainId: number;
  request: Record<string, unknown>;
  calls: Array<{
    to: Address;
    data: `0x${string}`;
    value: bigint;
  }>;
  accountAddress: Address;
}) {
  return {
    account: {
      address: params.accountAddress,
    },
    chain: {
      id: params.chainId,
      name: ArcTestnet.name,
    },
    sender:
      typeof params.request.sender === "string"
        ? params.request.sender
        : params.accountAddress,
    nonce:
      typeof params.request.nonce === "bigint"
        ? params.request.nonce.toString()
        : params.request.nonce ?? null,
    calls: params.calls.map((call) => ({
      target: call.to,
      calldataLength: Math.max((call.data.length - 2) / 2, 0),
      value: call.value.toString(),
    })),
    maxFeePerGas:
      typeof params.request.maxFeePerGas === "bigint"
        ? params.request.maxFeePerGas.toString()
        : params.request.maxFeePerGas ?? null,
    maxPriorityFeePerGas:
      typeof params.request.maxPriorityFeePerGas === "bigint"
        ? params.request.maxPriorityFeePerGas.toString()
        : params.request.maxPriorityFeePerGas ?? null,
    callGasLimit:
      typeof params.request.callGasLimit === "bigint"
        ? params.request.callGasLimit.toString()
        : params.request.callGasLimit ?? null,
    preVerificationGas:
      typeof params.request.preVerificationGas === "bigint"
        ? params.request.preVerificationGas.toString()
        : params.request.preVerificationGas ?? null,
    verificationGasLimit:
      typeof params.request.verificationGasLimit === "bigint"
        ? params.request.verificationGasLimit.toString()
        : params.request.verificationGasLimit ?? null,
    paymaster: params.request.paymaster ?? null,
    paymasterData: params.request.paymasterData ?? null,
    paymasterVerificationGasLimit:
      typeof params.request.paymasterVerificationGasLimit === "bigint"
        ? params.request.paymasterVerificationGasLimit.toString()
        : params.request.paymasterVerificationGasLimit ?? null,
    paymasterPostOpGasLimit:
      typeof params.request.paymasterPostOpGasLimit === "bigint"
        ? params.request.paymasterPostOpGasLimit.toString()
        : params.request.paymasterPostOpGasLimit ?? null,
  };
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
