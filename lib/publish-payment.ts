import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { WaitForUserOperationReceiptTimeoutError } from "viem/account-abstraction";
import { getArcUserOperationGasFees } from "@/lib/arc-gas";
import type { ModularWalletSession } from "@/lib/modular-wallet";

const PUBLISH_LOOKUP_TIMEOUT_MS = 15_000;
const PUBLISH_CONFIRMATION_ERROR_MESSAGE =
  "Payment was submitted but could not be confirmed. Please wait a moment and check your wallet/activity before retrying.";

export function assertPublishEnvironment() {
  if (!process.env.NEXT_PUBLIC_CLIENT_KEY) {
    throw new Error("Circle client key is missing.");
  }

  if (!process.env.NEXT_PUBLIC_CLIENT_URL) {
    throw new Error("Circle client URL is missing.");
  }
}

export async function executePublishFeePayment(params: {
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>;
  wallet: Address;
  treasuryWallet: Address;
  publishFeeUSDC: number;
  timeoutMs?: number;
}): Promise<{ userOpHash: Hash; transactionHash: Hash }> {
  assertPublishEnvironment();

  if (!isAddress(params.wallet)) {
    throw new Error("Publish wallet address is invalid.");
  }

  if (!isAddress(params.treasuryWallet)) {
    throw new Error("Publish treasury wallet is invalid.");
  }

  if (!Number.isFinite(params.publishFeeUSDC) || params.publishFeeUSDC <= 0) {
    throw new Error("Publish fee is invalid.");
  }

  const account = params.bundlerClient.account;
  if (!account) {
    throw new Error("Publish smart account is unavailable.");
  }

  const activeChainId = await params.bundlerClient.getChainId();
  if (activeChainId !== ArcTestnet.chainId) {
    throw new Error(`Publishing must run on Arc. Active chain id: ${activeChainId}.`);
  }

  const call = {
    to: ArcTestnet.usdcAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [params.treasuryWallet, parseUnits(params.publishFeeUSDC.toString(), 6)],
    }),
    value: BigInt(0),
  };

  console.info("STEP 3 Building user operation");
  const gasFees = await getArcUserOperationGasFees(params.bundlerClient.client);

  const request = {
    account,
    calls: [call],
    maxFeePerGas: gasFees.maxFeePerGas,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
  };

  let userOpHash: Hash;

  try {
    console.info("STEP 4 Sending user operation");
    userOpHash = await params.bundlerClient.sendUserOperation(request);
    console.info("STEP 5 User operation hash received", userOpHash);
  } catch (error) {
    console.error("[publish] sendUserOperation request", summarizePublishUserOperationRequest(request, activeChainId));
    throw error;
  }

  console.info("STEP 6 Waiting for confirmation");
  const confirmation = await waitForPublishConfirmation({
    bundlerClient: params.bundlerClient,
    userOpHash,
    timeoutMs: params.timeoutMs,
  });
  console.info("STEP 7 Confirmed", confirmation.transactionHash);

  return {
    userOpHash,
    transactionHash: confirmation.transactionHash,
  };
}

async function waitForPublishConfirmation(params: {
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>;
  userOpHash: Hash;
  timeoutMs?: number;
}): Promise<{ transactionHash: Hash }> {
  try {
    const receipt = await params.bundlerClient.waitForUserOperationReceipt({
      hash: params.userOpHash,
      timeout: params.timeoutMs,
    });
    const transactionHash = readReceiptTransactionHash(receipt);
    const blockNumber = readReceiptBlockNumber(receipt);

    if (transactionHash || blockNumber) {
      if (!transactionHash) {
        throw new Error(PUBLISH_CONFIRMATION_ERROR_MESSAGE);
      }

      return { transactionHash };
    }

    if ("success" in receipt && receipt.success === false) {
      throw new Error(
        readStringValue(receipt, "reason") ?? "USDC payment user operation reverted.",
      );
    }
  } catch (error) {
    if (!isPublishUserOperationTimeoutError(error) && !isPublishTimeoutError(error)) {
      throw error;
    }

    console.info("STEP 6A waitForUserOperationReceipt timed out", {
      userOpHash: params.userOpHash,
      error: error instanceof Error ? error.message : "unknown error",
    });

    const fallbackReceipt = await tryGetPublishUserOperationReceipt(
      params.bundlerClient,
      params.userOpHash,
    );
    console.info("STEP 6B fallback receipt lookup result", {
      userOpHash: params.userOpHash,
      blockNumber: fallbackReceipt?.blockNumber ?? null,
      transactionHash: fallbackReceipt?.transactionHash ?? null,
    });

    if (fallbackReceipt?.transactionHash) {
      return { transactionHash: fallbackReceipt.transactionHash };
    }

    const fallbackOperation = await tryGetPublishUserOperation(
      params.bundlerClient,
      params.userOpHash,
    );
    console.info("STEP 6C fallback operation lookup result", {
      userOpHash: params.userOpHash,
      blockNumber: fallbackOperation?.blockNumber ?? null,
      transactionHash: fallbackOperation?.transactionHash ?? null,
    });

    if (fallbackOperation?.transactionHash) {
      return { transactionHash: fallbackOperation.transactionHash };
    }

    if (fallbackReceipt?.blockNumber || fallbackOperation?.blockNumber) {
      throw new Error(PUBLISH_CONFIRMATION_ERROR_MESSAGE);
    }

    throw new Error(PUBLISH_CONFIRMATION_ERROR_MESSAGE);
  }

  throw new Error(PUBLISH_CONFIRMATION_ERROR_MESSAGE);
}

async function tryGetPublishUserOperationReceipt(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
  userOpHash: Hash,
) {
  try {
    const receipt = await withTimeout(
      requestPublishUserOperationReceipt(bundlerClient, userOpHash),
      PUBLISH_LOOKUP_TIMEOUT_MS,
      "publish getUserOperationReceipt",
    );
    const transactionHash = readReceiptTransactionHash(receipt);
    const blockNumber = readReceiptBlockNumber(receipt);

    if (!transactionHash && !blockNumber) {
      return null;
    }

    return {
      transactionHash,
      blockNumber,
    };
  } catch {
    return null;
  }
}

async function tryGetPublishUserOperation(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
  userOpHash: Hash,
) {
  try {
    const userOperation = await withTimeout(
      requestPublishUserOperation(bundlerClient, userOpHash),
      PUBLISH_LOOKUP_TIMEOUT_MS,
      "publish getUserOperation",
    );
    const transactionHash = readHashValue(
      userOperation,
      "transactionHash",
      "receipt.transactionHash",
    );
    const blockNumber = readStringValue(userOperation, "blockNumber", "receipt.blockNumber");

    if (!transactionHash && !blockNumber) {
      return null;
    }

    return {
      transactionHash,
      blockNumber,
    };
  } catch {
    return null;
  }
}

async function requestPublishUserOperationReceipt(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
  userOpHash: Hash,
) {
  const getUserOperationReceipt = (
    bundlerClient as NonNullable<ModularWalletSession["bundlerClient"]> & {
      getUserOperationReceipt?: (args: { hash: Hash }) => Promise<unknown>;
    }
  ).getUserOperationReceipt;

  if (typeof getUserOperationReceipt === "function") {
    return getUserOperationReceipt.call(bundlerClient, { hash: userOpHash });
  }

  const request = (
    bundlerClient as NonNullable<ModularWalletSession["bundlerClient"]> & {
      request?: (args: { method: string; params: Array<Hash> }) => Promise<unknown>;
    }
  ).request;

  if (typeof request !== "function") {
    return null;
  }

  return request.call(bundlerClient, {
    method: "eth_getUserOperationReceipt",
    params: [userOpHash],
  });
}

async function requestPublishUserOperation(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
  userOpHash: Hash,
) {
  const getUserOperation = (
    bundlerClient as NonNullable<ModularWalletSession["bundlerClient"]> & {
      getUserOperation?: (args: { hash: Hash }) => Promise<unknown>;
    }
  ).getUserOperation;

  if (typeof getUserOperation === "function") {
    return getUserOperation.call(bundlerClient, { hash: userOpHash });
  }

  const request = (
    bundlerClient as NonNullable<ModularWalletSession["bundlerClient"]> & {
      request?: (args: { method: string; params: Array<Hash> }) => Promise<unknown>;
    }
  ).request;

  if (typeof request !== "function") {
    return null;
  }

  return request.call(bundlerClient, {
    method: "eth_getUserOperationByHash",
    params: [userOpHash],
  });
}

function readReceiptTransactionHash(value: unknown) {
  return readHashValue(value, "receipt.transactionHash", "transactionHash");
}

function readReceiptBlockNumber(value: unknown) {
  return readStringValue(value, "receipt.blockNumber", "blockNumber");
}

function readHashValue(value: unknown, ...paths: string[]) {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);
    if (typeof candidate === "string" && candidate.startsWith("0x")) {
      return candidate as Hash;
    }
  }

  return null;
}

function readStringValue(value: unknown, ...paths: string[]) {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function readNestedValue(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}

function isPublishUserOperationTimeoutError(error: unknown) {
  return error instanceof WaitForUserOperationReceiptTimeoutError;
}

function isPublishTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || /timed out/i.test(error.message))
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

function summarizePublishUserOperationRequest(
  request: {
    account: NonNullable<ModularWalletSession["bundlerClient"]>["account"];
    calls: Array<{
      to: Address;
      data: `0x${string}`;
      value: bigint;
    }>;
  },
  chainId: number,
) {
  return {
    account: request.account ? { address: request.account.address } : null,
    chain: {
      id: chainId,
      name: ArcTestnet.name,
    },
    calls: request.calls.map((call) => ({
      target: call.to,
      calldataLength: Math.max((call.data.length - 2) / 2, 0),
      value: call.value.toString(),
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
      verificationGasLimit: null,
      callGasLimit: null,
      preVerificationGas: null,
      paymasterVerificationGasLimit: null,
      paymasterPostOpGasLimit: null,
    })),
  };
}
