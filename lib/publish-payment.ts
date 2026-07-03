import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  toModularTransport,
} from "@circle-fin/modular-wallets-core";
import { createPublicClient, encodeFunctionData, erc20Abi, parseUnits, type Address, type PublicClient } from "viem";
import { createBundlerClient, type BundlerClient } from "viem/account-abstraction";
import { arcTestnet } from "viem/chains";
import { getArcUserOperationGasFees } from "@/lib/arc-gas";
import type { ModularWalletSession } from "@/lib/modular-wallet";

const MODULAR_WALLET_CHAIN_PATH = "arcTestnet";

export type PublishBundlerClient = BundlerClient & {
  client: PublicClient;
};

export function createPublishBundlerClient(session: {
  smartAccount: ModularWalletSession["smartAccount"];
}) {
  const { clientKey, clientUrl } = getClientEnv();
  const transport = toModularTransport(getChainClientUrl(clientUrl), clientKey);

  if (typeof transport !== "function") {
    throw new Error("Publish transport is invalid.");
  }

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport,
  });

  const bundlerClient = createBundlerClient({
    account: session.smartAccount,
    chain: arcTestnet,
    client: publicClient,
    transport,
  });

  if (bundlerClient.paymaster) {
    throw new Error("Publish paymaster sponsorship must be disabled.");
  }

  return bundlerClient as PublishBundlerClient;
}

export async function assertPublishNativeGasBalance(params: {
  bundlerClient: PublishBundlerClient;
  wallet: Address;
  treasuryWallet: Address;
  amountUSDC: number;
}) {
  if (!params.wallet) {
    throw new Error("Publish wallet address is unavailable.");
  }

  if (!params.treasuryWallet) {
    throw new Error("Publish treasury wallet is unavailable.");
  }

  if (!Number.isFinite(params.amountUSDC) || params.amountUSDC <= 0) {
    throw new Error("Publish fee is invalid.");
  }

  const chainId = await params.bundlerClient.getChainId();
  if (chainId !== arcTestnet.id) {
    throw new Error(`Publishing must run on Arc. Active chain id: ${chainId}.`);
  }

  const publicClient = params.bundlerClient.client;
  if (!publicClient) {
    throw new Error("Publish Arc client is unavailable.");
  }

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
