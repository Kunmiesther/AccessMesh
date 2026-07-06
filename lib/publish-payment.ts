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
import type { ModularWalletSession } from "@/lib/modular-wallet";

const PUBLISH_LOOKUP_TIMEOUT_MS = 15_000;
const PUBLISH_CONFIRMATION_ERROR_MESSAGE =
  "Payment was submitted but could not be confirmed. Please wait a moment and check your wallet/activity before retrying.";

type PublishBundlerClient = NonNullable<ModularWalletSession["bundlerClient"]>;
type PublishCall = {
  to: Address;
  data: `0x${string}`;
  value: bigint;
};

export function assertPublishEnvironment() {
  if (!process.env.NEXT_PUBLIC_CLIENT_KEY) {
    throw new Error("Circle client key is missing.");
  }

  if (!process.env.NEXT_PUBLIC_CLIENT_URL) {
    throw new Error("Circle client URL is missing.");
  }
}

export async function executePublishFeePayment(params: {
  bundlerClient: PublishBundlerClient;
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

  const call: PublishCall = {
    to: ArcTestnet.usdcAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [params.treasuryWallet, parseUnits(params.publishFeeUSDC.toString(), 6)],
    }),
    value: BigInt(0),
  };

  const request = {
    account,
    calls: [call],
  };

  console.info("STEP 3 Building user operation");
  console.info(
    "[publish] user operation request",
    summarizePublishUserOperationRequest({
      request,
      chainId: activeChainId,
      accountAddress: account.address,
      calls: [call],
    }),
  );

  let userOpHash: Hash;

  try {
    console.info("STEP 4 Sending user operation");
    userOpHash = await params.bundlerClient.sendUserOperation(request);
    console.info("STEP 5 User operation hash received", userOpHash);
  } catch (error) {
    console.error(
      "[publish] sendUserOperation request",
      summarizePublishUserOperationRequest({
        request,
        chainId: activeChainId,
        accountAddress: account.address,
        calls: [call],
      }),
    );
    throw error;
  }

  const confirmation = await waitForPublishConfirmation({
    bundlerClient: params.bundlerClient,
    userOpHash,
    timeoutMs: params.timeoutMs,
  });
  console.info("STEP 7 Payment confirmed", confirmation.transactionHash);

  return {
    userOpHash,
    transactionHash: confirmation.transactionHash,
  };
}

async function waitForPublishConfirmation(params: {
  bundlerClient: PublishBundlerClient;
  userOpHash: Hash;
  timeoutMs?: number;
}): Promise<{ transactionHash: Hash }> {
  const timeoutMs = params.timeoutMs ?? 300_000;

  console.info("STEP 6 Waiting for confirmation");

  try {
    const receipt = await withTimeout(
      params.bundlerClient.waitForUserOperationReceipt({
        hash: params.userOpHash,
        timeout: timeoutMs,
      }),
      timeoutMs,
      "publish waitForUserOperationReceipt",
    );

    if (!receipt.success) {
      throw new Error(receipt.reason ?? "USDC payment user operation reverted.");
    }

    return {
      transactionHash: receipt.receipt.transactionHash,
    };
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
      blockNumber: fallbackReceipt?.receipt?.blockNumber ?? null,
      transactionHash: fallbackReceipt?.receipt?.transactionHash ?? null,
    });

    if (fallbackReceipt?.receipt?.transactionHash) {
      return {
        transactionHash: fallbackReceipt.receipt.transactionHash,
      };
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
      return {
        transactionHash: fallbackOperation.transactionHash,
      };
    }

    throw new Error(PUBLISH_CONFIRMATION_ERROR_MESSAGE);
  }
}

async function tryGetPublishUserOperationReceipt(
  bundlerClient: PublishBundlerClient,
  userOpHash: Hash,
) {
  try {
    const receipt = await withTimeout(
      bundlerClient.getUserOperationReceipt({ hash: userOpHash }),
      PUBLISH_LOOKUP_TIMEOUT_MS,
      "publish getUserOperationReceipt",
    );

    if (
      receipt?.receipt?.blockNumber == null ||
      receipt.receipt.transactionHash == null
    ) {
      return null;
    }

    return receipt;
  } catch {
    return null;
  }
}

async function tryGetPublishUserOperation(
  bundlerClient: PublishBundlerClient,
  userOpHash: Hash,
) {
  try {
    const userOperation = await withTimeout(
      bundlerClient.getUserOperation({ hash: userOpHash }),
      PUBLISH_LOOKUP_TIMEOUT_MS,
      "publish getUserOperation",
    );

    if (
      userOperation?.blockNumber == null ||
      userOperation.transactionHash == null
    ) {
      return null;
    }

    return userOperation;
  } catch {
    return null;
  }
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

function summarizePublishUserOperationRequest(params: {
  request: {
    account: PublishBundlerClient["account"];
    calls: PublishCall[];
    sender?: Address;
    callGasLimit?: bigint;
    verificationGasLimit?: bigint;
    preVerificationGas?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    paymaster?: Address;
    paymasterData?: `0x${string}`;
    paymasterVerificationGasLimit?: bigint;
    paymasterPostOpGasLimit?: bigint;
  };
  chainId: number;
  accountAddress: Address;
  calls: PublishCall[];
}) {
  const firstCall = params.calls[0];

  return {
    accountAddress: params.accountAddress,
    sender: params.request.sender ?? params.accountAddress,
    chainId: params.chainId,
    callsCount: params.calls.length,
    firstCallTarget: firstCall?.to ?? null,
    firstCallCalldataLength: firstCall
      ? Math.max((firstCall.data.length - 2) / 2, 0)
      : null,
    callGasLimit: stringifyBigInt(params.request.callGasLimit),
    verificationGasLimit: stringifyBigInt(params.request.verificationGasLimit),
    preVerificationGas: stringifyBigInt(params.request.preVerificationGas),
    maxFeePerGas: stringifyBigInt(params.request.maxFeePerGas),
    maxPriorityFeePerGas: stringifyBigInt(params.request.maxPriorityFeePerGas),
    paymasterPresent: Boolean(params.request.paymaster),
    paymasterDataPresent: Boolean(params.request.paymasterData),
    paymasterVerificationGasLimitPresent:
      typeof params.request.paymasterVerificationGasLimit !== "undefined",
    paymasterPostOpGasLimitPresent:
      typeof params.request.paymasterPostOpGasLimit !== "undefined",
  };
}

function stringifyBigInt(value: bigint | undefined) {
  return typeof value === "bigint" ? value.toString() : null;
}
