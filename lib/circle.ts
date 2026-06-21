import { AppKit } from "@circle-fin/app-kit";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  createViemAdapterFromProvider,
  type CreateViemAdapterFromProviderParams,
} from "@circle-fin/adapter-viem-v2";
import { createPublicClient, defineChain, http } from "viem";

const arcRpcUrl =
  process.env.ARC_RPC_URL ??
  process.env.VIEM_RPC_URL ??
  ArcTestnet.rpcEndpoints[0];

export const arcChain = ArcTestnet;

export const arcViemChain = defineChain({
  id: ArcTestnet.chainId,
  name: ArcTestnet.name,
  nativeCurrency: ArcTestnet.nativeCurrency,
  rpcUrls: {
    default: { http: [arcRpcUrl] },
    public: { http: [arcRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Arcscan Testnet",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const arcPublicClient = createPublicClient({
  chain: arcViemChain,
  transport: http(arcRpcUrl),
});

export const circleAppKit = new AppKit({
  disableErrorReporting: process.env.NODE_ENV === "test",
});

export const circlePaymentClient = {
  appKit: circleAppKit,
  chain: arcChain,
  publicClient: arcPublicClient,
  appKey: process.env.CIRCLE_APP_KEY,
  usdcAddress: ArcTestnet.usdcAddress,
  rpcUrl: arcRpcUrl,
};

export function createArcViemAdapterFromProvider(
  provider: CreateViemAdapterFromProviderParams["provider"],
) {
  return createViemAdapterFromProvider({
    provider,
    getPublicClient: () => arcPublicClient,
    capabilities: {
      addressContext: "user-controlled",
      supportedChains: [ArcTestnet],
    },
  });
}

export function buildCircleSendRequirement(params: {
  amountUSDC: number;
  providerWallet: string;
}) {
  return {
    kit: "@circle-fin/app-kit",
    adapter: "@circle-fin/adapter-viem-v2",
    operation: "send",
    chain: {
      name: ArcTestnet.name,
      chainId: ArcTestnet.chainId,
      chainKey: ArcTestnet.chain,
      rpcUrl: arcRpcUrl,
      explorerUrl: ArcTestnet.explorerUrl,
    },
    token: {
      symbol: "USDC",
      address: ArcTestnet.usdcAddress,
      decimals: 6,
    },
    sendParams: {
      to: params.providerWallet,
      amount: params.amountUSDC.toString(),
      token: "USDC",
      chain: ArcTestnet.chain,
    },
  };
}
