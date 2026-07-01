"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  parseUnits,
  pad,
  type Address,
  type Hash,
} from "viem";
import {
  CCTP_EMPTY_DESTINATION_CALLER,
  CCTP_FINALITY_THRESHOLD_FAST,
  CCTP_FORWARDING_HOOK_DATA,
  cctpArcTestnetChain,
  cctpArcTestnetTransport,
  cctpBaseSepoliaChain,
  cctpBaseSepoliaTransport,
  cctpDestinationChain,
  cctpSourceChains,
  type SupportedCctpSourceKey,
} from "@/lib/cctp-config";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type CctpQuote = {
  sourceChain: {
    key: SupportedCctpSourceKey;
    name: string;
    chainId: number;
    domain: number;
  };
  destinationChain: {
    key: string;
    name: string;
    chainId: number;
    domain: number;
  };
  amount: string;
  maxFee: string;
  totalBurnAmount: string;
  feeUSDC: number;
  totalBurnUSDC: number;
  finalityThreshold: number;
  estimatedCompletion: string;
};

export type SourceUsdcBalance = {
  sourceKey: SupportedCctpSourceKey;
  chainName: string;
  wallet: Address;
  balance: bigint;
  balanceUSDC: number;
};

export type CctpBridgeExecution = {
  sourceKey: SupportedCctpSourceKey;
  sourceWallet: Address;
  amountUSDC: number;
  feeUSDC: number;
  totalBurnUSDC: number;
  sourceTxHash: Hash;
  destinationTxHash: Hash;
  quote: CctpQuote;
};

const sourceKey: SupportedCctpSourceKey = "base-sepolia";
const sourceChain = cctpSourceChains[sourceKey];

export async function readArcUsdcBalance(address: string) {
  const publicClient = createPublicClient({
    chain: cctpArcTestnetChain,
    transport: cctpArcTestnetTransport,
  });

  return publicClient.readContract({
    address: cctpDestinationChain.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [getAddress(address)],
  });
}

export async function findSupportedSourceBalance(
  requiredAmount: bigint,
): Promise<SourceUsdcBalance | null> {
  const provider = getEthereumProvider();
  if (!provider) {
    return null;
  }

  const wallet = await getSourceWalletAddress(provider);
  if (!wallet) {
    return null;
  }

  const publicClient = createPublicClient({
    chain: cctpBaseSepoliaChain,
    transport: cctpBaseSepoliaTransport,
  });

  const balance = await publicClient.readContract({
    address: sourceChain.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });

  if (balance < requiredAmount) {
    return null;
  }

  return {
    sourceKey,
    chainName: sourceChain.name,
    wallet,
    balance,
    balanceUSDC: Number(formatUnits(balance, 6)),
  };
}

export async function getCctpQuote(params: {
  sourceKey: SupportedCctpSourceKey;
  amount: bigint;
}) {
  const query = new URLSearchParams({
    source: params.sourceKey,
    amount: params.amount.toString(),
  });
  const response = await fetch(`/api/cctp/quote?${query}`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = (await response.json()) as {
    ok?: boolean;
    quote?: CctpQuote;
    error?: { message?: string };
  };

  if (!response.ok || !data.quote) {
    throw new Error(data.error?.message ?? "CCTP quote failed.");
  }

  return data.quote;
}

export async function executeCctpBridge(params: {
  sourceWallet: Address;
  destinationAddress: Address;
  amountUSDC: number;
  quote: CctpQuote;
  onStep?: (step: "preparing" | "approving" | "bridging" | "receiving") => void;
  onSourceTx?: (sourceTxHash: Hash) => Promise<void> | void;
}) {
  const provider = requireEthereumProvider();
  const walletClient = createWalletClient({
    chain: cctpBaseSepoliaChain,
    transport: custom(provider),
    account: params.sourceWallet,
  });
  const publicClient = createPublicClient({
    chain: cctpBaseSepoliaChain,
    transport: cctpBaseSepoliaTransport,
  });

  params.onStep?.("preparing");
  await ensureSourceChain(provider);

  params.onStep?.("approving");
  const approveTxHash = await walletClient.sendTransaction({
    account: params.sourceWallet,
    to: sourceChain.usdcAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [
        sourceChain.tokenMessengerV2 as Address,
        BigInt(params.quote.totalBurnAmount),
      ],
    }),
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

  params.onStep?.("bridging");
  const sourceTxHash = await walletClient.sendTransaction({
    account: params.sourceWallet,
    to: sourceChain.tokenMessengerV2 as Address,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "depositForBurnWithHook",
          stateMutability: "nonpayable",
          inputs: [
            { name: "amount", type: "uint256" },
            { name: "destinationDomain", type: "uint32" },
            { name: "mintRecipient", type: "bytes32" },
            { name: "burnToken", type: "address" },
            { name: "destinationCaller", type: "bytes32" },
            { name: "maxFee", type: "uint256" },
            { name: "minFinalityThreshold", type: "uint32" },
            { name: "hookData", type: "bytes" },
          ],
          outputs: [],
        },
      ],
      functionName: "depositForBurnWithHook",
      args: [
        BigInt(params.quote.totalBurnAmount),
        cctpDestinationChain.domain,
        pad(params.destinationAddress, { size: 32 }),
        sourceChain.usdcAddress,
        CCTP_EMPTY_DESTINATION_CALLER,
        BigInt(params.quote.maxFee),
        CCTP_FINALITY_THRESHOLD_FAST,
        CCTP_FORWARDING_HOOK_DATA,
      ],
    }),
  });
  await publicClient.waitForTransactionReceipt({ hash: sourceTxHash });
  await params.onSourceTx?.(sourceTxHash);

  params.onStep?.("receiving");
  const destinationTxHash = await waitForForwardedMint({
    sourceKey,
    sourceTxHash,
  });

  return {
    sourceKey,
    sourceWallet: params.sourceWallet,
    amountUSDC: params.amountUSDC,
    feeUSDC: params.quote.feeUSDC,
    totalBurnUSDC: params.quote.totalBurnUSDC,
    sourceTxHash,
    destinationTxHash,
    quote: params.quote,
  } satisfies CctpBridgeExecution;
}

export function amountToUsdcSubunits(amountUSDC: number) {
  return parseUnits(amountUSDC.toString(), 6);
}

async function waitForForwardedMint(params: {
  sourceKey: SupportedCctpSourceKey;
  sourceTxHash: Hash;
}) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const query = new URLSearchParams({
      source: params.sourceKey,
      transactionHash: params.sourceTxHash,
    });
    const response = await fetch(`/api/cctp/status?${query}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json()) as {
      ok?: boolean;
      status?: {
        forwardTxHash?: Hash | null;
      };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message ?? "CCTP status lookup failed.");
    }

    if (data.status?.forwardTxHash) {
      return data.status.forwardTxHash;
    }

    await delay(5000);
  }

  throw new Error("Timed out waiting for Circle to mint USDC on Arc.");
}

async function ensureSourceChain(provider: EthereumProvider) {
  const chainId = `0x${sourceChain.chainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error: unknown) {
    if (isWalletMissingChainError(error)) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: sourceChain.name,
            nativeCurrency: cctpBaseSepoliaChain.nativeCurrency,
            rpcUrls: [...sourceChain.rpcUrls],
            blockExplorerUrls: ["https://sepolia.basescan.org"],
          },
        ],
      });
      return;
    }

    throw error;
  }
}

async function getSourceWalletAddress(provider: EthereumProvider) {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = accounts[0];

  return account ? getAddress(account) : null;
}

function requireEthereumProvider() {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("Connect a Base Sepolia wallet to bridge USDC.");
  }

  return provider;
}

function getEthereumProvider(): EthereumProvider | null {
  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return ethereum ?? null;
}

function isWalletMissingChainError(error: unknown) {
  const maybeError = error as { code?: number };
  return maybeError?.code === 4902;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
