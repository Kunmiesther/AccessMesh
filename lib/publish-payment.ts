import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
  type PublicClient,
} from "viem";
import { getArcUserOperationGasFees } from "@/lib/arc-gas";
import type { ModularWalletSession } from "@/lib/modular-wallet";
import {
  confirmUsdcPayment,
  submitUsdcPayment,
} from "@/lib/usdc-transfer";

export function assertPublishEnvironment() {
  if (!process.env.NEXT_PUBLIC_CLIENT_KEY) {
    throw new Error("Circle client key is missing.");
  }

  if (!process.env.NEXT_PUBLIC_CLIENT_URL) {
    throw new Error("Circle client URL is missing.");
  }
}

export function isPublishTransportValid(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
) {
  return (
    Boolean(bundlerClient.account) &&
    Boolean(bundlerClient.client) &&
    typeof bundlerClient.getChainId === "function" &&
    typeof bundlerClient.sendUserOperation === "function" &&
    typeof bundlerClient.waitForUserOperationReceipt === "function" &&
    typeof bundlerClient.getUserOperationReceipt === "function" &&
    typeof bundlerClient.getUserOperation === "function" &&
    typeof bundlerClient.client?.getBalance === "function" &&
    typeof bundlerClient.client?.estimateFeesPerGas === "function"
  );
}

export function assertPublishClientReady(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
) {
  if (!bundlerClient.account) {
    throw new Error("Publish smart account is unavailable.");
  }

  if (!bundlerClient.client) {
    throw new Error("Publish bundler client is malformed.");
  }

  if (typeof bundlerClient.getChainId !== "function") {
    throw new Error("Publish transport is invalid.");
  }

  if (
    typeof bundlerClient.sendUserOperation !== "function" ||
    typeof bundlerClient.waitForUserOperationReceipt !== "function" ||
    typeof bundlerClient.getUserOperationReceipt !== "function" ||
    typeof bundlerClient.getUserOperation !== "function"
  ) {
    throw new Error("Publish bundler client is malformed.");
  }

  if (
    typeof bundlerClient.client.getBalance !== "function" ||
    typeof bundlerClient.client.estimateFeesPerGas !== "function"
  ) {
    throw new Error("Publish Arc client is invalid.");
  }
}

export function getPublishPaymasterMode(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
) {
  return bundlerClient.paymaster ? "enabled" : "disabled";
}

export async function executePublishFeePayment(params: {
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>;
  wallet: Address;
  treasuryWallet: Address;
  publishFeeUSDC: number;
  timeoutMs?: number;
}): Promise<{ userOpHash: Hash; transactionHash: Hash }> {
  assertPublishEnvironment();

  console.info("[publish] wallet", params.wallet);
  console.info("[publish] treasury wallet", params.treasuryWallet);
  console.info("[publish] publish fee", params.publishFeeUSDC);
  console.info("[publish] USDC contract", ArcTestnet.usdcAddress);

  if (!isAddress(params.wallet)) {
    throw new Error("Publish wallet address is invalid.");
  }

  if (!isAddress(params.treasuryWallet)) {
    throw new Error("Publish treasury wallet is invalid.");
  }

  if (!Number.isFinite(params.publishFeeUSDC) || params.publishFeeUSDC <= 0) {
    throw new Error("Publish fee is invalid.");
  }

  const transportValid = isPublishTransportValid(params.bundlerClient);
  console.info("[publish] transport valid", transportValid);
  if (!transportValid) {
    throw new Error("Publish transport is invalid.");
  }

  assertPublishClientReady(params.bundlerClient);

  const activeChainId = await params.bundlerClient.getChainId();
  console.info("[publish] Arc chain id", activeChainId);
  if (activeChainId !== ArcTestnet.chainId) {
    throw new Error(`Publishing must run on Arc. Active chain id: ${activeChainId}.`);
  }

  await assertPublishNativeGasBalance({
    bundlerClient: params.bundlerClient,
    wallet: params.wallet,
    treasuryWallet: params.treasuryWallet,
    amountUSDC: params.publishFeeUSDC,
  });

  console.info("[publish] sending publish fee");
  const userOpHash = await submitUsdcPayment({
    bundlerClient: params.bundlerClient,
    transfers: [
      {
        recipientWallet: params.treasuryWallet,
        amountUSDC: params.publishFeeUSDC,
      },
    ],
  });

  const confirmation = await confirmUsdcPayment({
    bundlerClient: params.bundlerClient,
    userOpHash,
    timeoutMs: params.timeoutMs,
  });

  if (confirmation.status !== "confirmed") {
    throw new Error("Transaction submitted but still pending.");
  }

  return {
    userOpHash,
    transactionHash: confirmation.transactionHash,
  };
}

export async function assertPublishNativeGasBalance(params: {
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>;
  wallet: Address;
  treasuryWallet: Address;
  amountUSDC: number;
}) {
  if (!isAddress(params.wallet)) {
    throw new Error("Publish wallet address is invalid.");
  }

  if (!isAddress(params.treasuryWallet)) {
    throw new Error("Publish treasury wallet is invalid.");
  }

  if (!Number.isFinite(params.amountUSDC) || params.amountUSDC <= 0) {
    throw new Error("Publish fee is invalid.");
  }

  const chainId = await params.bundlerClient.getChainId();
  if (chainId !== ArcTestnet.chainId) {
    throw new Error(`Publishing must run on Arc. Active chain id: ${chainId}.`);
  }

  const publicClient = getPublishPublicClient(params.bundlerClient);

  const nativeGasBalance = await publicClient.getBalance({
    address: params.wallet,
  });

  if (nativeGasBalance === BigInt(0)) {
    throw new Error("You need Arc testnet gas to publish this resource.");
  }

  const gasFees = await getArcUserOperationGasFees(publicClient);
  const publishGasEstimate = await params.bundlerClient.estimateUserOperationGas({
    calls: [
      {
        to: ArcTestnet.usdcAddress as Address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [params.treasuryWallet, parseUnits(params.amountUSDC.toString(), 6)],
        }),
        value: BigInt(0),
      },
    ],
  });

  const estimatedGasCost =
    (publishGasEstimate.preVerificationGas +
      publishGasEstimate.verificationGasLimit +
      publishGasEstimate.callGasLimit +
      (publishGasEstimate.paymasterVerificationGasLimit ?? BigInt(0)) +
      (publishGasEstimate.paymasterPostOpGasLimit ?? BigInt(0))) *
    gasFees.maxFeePerGas;

  if (nativeGasBalance < estimatedGasCost) {
    throw new Error("You need Arc testnet gas to publish this resource.");
  }
}

function getPublishPublicClient(
  bundlerClient: NonNullable<ModularWalletSession["bundlerClient"]>,
) {
  const publicClient = bundlerClient.client as PublicClient | undefined;
  if (!publicClient) {
    throw new Error("Publish Arc client is unavailable.");
  }

  if (typeof publicClient.getBalance !== "function") {
    throw new Error("Publish Arc client is invalid.");
  }

  return publicClient;
}
