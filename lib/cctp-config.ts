import { ArcTestnet, BaseSepolia } from "@circle-fin/app-kit/chains";
import { defineChain, http, type Address } from "viem";

export type SupportedCctpSourceKey = "base-sepolia";

export type CctpChainConfig = {
  key: SupportedCctpSourceKey | "arc-testnet";
  chainId: number;
  domain: number;
  name: string;
  explorerUrl: string;
  rpcUrls: readonly string[];
  usdcAddress: Address;
  tokenMessengerV2?: Address;
  messageTransmitterV2?: Address;
  estimatedCompletion: string;
};

export const cctpDestinationChain: CctpChainConfig = {
  key: "arc-testnet",
  chainId: ArcTestnet.chainId,
  domain: ArcTestnet.cctp.domain,
  name: ArcTestnet.name,
  explorerUrl: ArcTestnet.explorerUrl,
  rpcUrls: ArcTestnet.rpcEndpoints,
  usdcAddress: ArcTestnet.usdcAddress as Address,
  tokenMessengerV2: ArcTestnet.cctp.contracts.v2.tokenMessenger as Address,
  messageTransmitterV2: ArcTestnet.cctp.contracts.v2.messageTransmitter as Address,
  estimatedCompletion: "8-20 seconds after source confirmation",
};

export const cctpSourceChains: Record<SupportedCctpSourceKey, CctpChainConfig> = {
  "base-sepolia": {
    key: "base-sepolia",
    chainId: BaseSepolia.chainId,
    domain: BaseSepolia.cctp.domain,
    name: BaseSepolia.name,
    explorerUrl: BaseSepolia.explorerUrl,
    rpcUrls: BaseSepolia.rpcEndpoints,
    usdcAddress: BaseSepolia.usdcAddress as Address,
    tokenMessengerV2: BaseSepolia.cctp.contracts.v2.tokenMessenger as Address,
    messageTransmitterV2:
      BaseSepolia.cctp.contracts.v2.messageTransmitter as Address,
    estimatedCompletion: "8-20 seconds after source confirmation",
  },
};

export const supportedCctpSources = Object.values(cctpSourceChains);

export const CCTP_FINALITY_THRESHOLD_FAST = 1000;
export const CCTP_FORWARDING_HOOK_DATA =
  "0x636374702d666f72776172640000000000000000000000000000000000000000" as const;
export const CCTP_EMPTY_DESTINATION_CALLER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const cctpIrisApiBase =
  process.env.NEXT_PUBLIC_CCTP_IRIS_API_BASE ??
  process.env.CCTP_IRIS_API_BASE ??
  "https://iris-api-sandbox.circle.com";

export const cctpBaseSepoliaChain = defineChain({
  id: BaseSepolia.chainId,
  name: BaseSepolia.name,
  nativeCurrency: BaseSepolia.nativeCurrency,
  rpcUrls: {
    default: { http: [...BaseSepolia.rpcEndpoints] },
    public: { http: [...BaseSepolia.rpcEndpoints] },
  },
  blockExplorers: {
    default: {
      name: "Base Sepolia Explorer",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
});

export const cctpBaseSepoliaTransport = http(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    process.env.BASE_SEPOLIA_RPC_URL ??
    BaseSepolia.rpcEndpoints[0],
);

export const cctpArcTestnetChain = defineChain({
  id: ArcTestnet.chainId,
  name: ArcTestnet.name,
  nativeCurrency: ArcTestnet.nativeCurrency,
  rpcUrls: {
    default: { http: [...ArcTestnet.rpcEndpoints] },
    public: { http: [...ArcTestnet.rpcEndpoints] },
  },
  blockExplorers: {
    default: {
      name: "Arcscan Testnet",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const cctpArcTestnetTransport = http(
  process.env.NEXT_PUBLIC_ARC_RPC_URL ??
    process.env.ARC_RPC_URL ??
    ArcTestnet.rpcEndpoints[0],
);
