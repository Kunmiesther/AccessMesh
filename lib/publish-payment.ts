import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import type { ModularWalletSession } from "@/lib/modular-wallet";

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

  const request = {
    account,
    calls: [call],
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

  const receipt = await params.bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: params.timeoutMs,
  });

  if (!receipt.success) {
    throw new Error(receipt.reason ?? "USDC payment user operation reverted.");
  }

  console.info("STEP 7 Confirmed", receipt.receipt.transactionHash);

  return {
    userOpHash,
    transactionHash: receipt.receipt.transactionHash,
  };
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
