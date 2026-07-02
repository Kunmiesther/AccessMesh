import { ArcTestnet, BaseSepolia } from "@circle-fin/app-kit/chains";
import { defineChain, http, type Address, type Chain } from "viem";

export type CctpChainConfig = {
  key: string;
  chain: Chain;
  chainId: number;
  domain: number;
  name: string;
  explorerUrl: string;
  rpcUrls: readonly string[];
  modularTransportPath: string;
  usdcAddress: Address;
  tokenMessengerV2?: Address;
  messageTransmitterV2?: Address;
  estimatedCompletion: string;
};

export const cctpDestinationChain = {
  key: "arc-testnet",
  chain: defineChain({
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
  }),
  chainId: ArcTestnet.chainId,
  domain: ArcTestnet.cctp.domain,
  name: ArcTestnet.name,
  explorerUrl: ArcTestnet.explorerUrl,
  rpcUrls: ArcTestnet.rpcEndpoints,
  modularTransportPath: "arcTestnet",
  usdcAddress: ArcTestnet.usdcAddress as Address,
  tokenMessengerV2: ArcTestnet.cctp.contracts.v2.tokenMessenger as Address,
  messageTransmitterV2:
    ArcTestnet.cctp.contracts.v2.messageTransmitter as Address,
  estimatedCompletion: "8-20 seconds after source confirmation",
} satisfies CctpChainConfig;

export const supportedCctpSourceChains = {
  "base-sepolia": {
    key: "base-sepolia",
    chain: defineChain({
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
    }),
    chainId: BaseSepolia.chainId,
    domain: BaseSepolia.cctp.domain,
    name: BaseSepolia.name,
    explorerUrl: BaseSepolia.explorerUrl,
    rpcUrls: BaseSepolia.rpcEndpoints,
    modularTransportPath: "baseSepolia",
    usdcAddress: BaseSepolia.usdcAddress as Address,
    tokenMessengerV2: BaseSepolia.cctp.contracts.v2.tokenMessenger as Address,
    messageTransmitterV2:
      BaseSepolia.cctp.contracts.v2.messageTransmitter as Address,
    estimatedCompletion: "8-20 seconds after source confirmation",
  },
} satisfies Record<string, CctpChainConfig>;

export type SupportedCctpSourceKey = keyof typeof supportedCctpSourceChains;
export type SupportedCctpSourceChainConfig =
  (typeof supportedCctpSourceChains)[SupportedCctpSourceKey];

export const cctpSourceChains = supportedCctpSourceChains;
export const supportedCctpSources = Object.values(supportedCctpSourceChains);

export function isSupportedCctpSourceKey(
  value: string | null,
): value is SupportedCctpSourceKey {
  return Boolean(value && value in supportedCctpSourceChains);
}

export function getSupportedCctpSourceChain(key: SupportedCctpSourceKey) {
  return supportedCctpSourceChains[key];
}

export function getDefaultSupportedCctpSourceChain() {
  return supportedCctpSources[0] ?? null;
}

export function getSupportedCctpSourceChainByChainId(chainId: number) {
  return supportedCctpSources.find((chain) => chain.chainId === chainId) ?? null;
}

export function getCctpModularTransportUrl(
  clientUrl: string,
  chain: Pick<CctpChainConfig, "modularTransportPath">,
) {
  return `${clientUrl.replace(/\/+$/, "")}/${chain.modularTransportPath}`;
}

export const CCTP_FINALITY_THRESHOLD_FAST = 1000;
export const CCTP_FORWARDING_HOOK_DATA =
  "0x636374702d666f72776172640000000000000000000000000000000000000000" as const;
export const CCTP_EMPTY_DESTINATION_CALLER =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const cctpIrisApiBase =
  process.env.NEXT_PUBLIC_CCTP_IRIS_API_BASE ??
  process.env.CCTP_IRIS_API_BASE ??
  "https://iris-api-sandbox.circle.com";

export const cctpBaseSepoliaChain = supportedCctpSourceChains["base-sepolia"].chain;

export const cctpBaseSepoliaTransport = http(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    process.env.BASE_SEPOLIA_RPC_URL ??
    BaseSepolia.rpcEndpoints[0],
);

export const cctpArcTestnetChain = cctpDestinationChain.chain;

export const cctpArcTestnetTransport = http(
  process.env.NEXT_PUBLIC_ARC_RPC_URL ??
    process.env.ARC_RPC_URL ??
    ArcTestnet.rpcEndpoints[0],
);
