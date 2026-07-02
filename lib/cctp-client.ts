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
import { getStoredWalletSession, type StoredWalletSession } from "@/lib/modular-wallet";
import {
  toPasskeyTransport,
  walletClientToLocalAccount,
} from "@circle-fin/modular-wallets-core";

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

export type SourceBridgeState = SourceUsdcBalance & {
  kind: "circle" | "injected";
  walletClient: ReturnType<typeof createWalletClient>;
  nativeGasBalance: bigint;
  allowance: bigint;
  needsApproval: boolean;
  provider?: EthereumProvider;
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

type SourceWalletContext =
  | {
      kind: "circle";
      account: Address;
      address: Address;
      walletClient: ReturnType<typeof createWalletClient>;
    }
  | {
      kind: "injected";
      account: Address;
      address: Address;
      provider: EthereumProvider;
      walletClient: ReturnType<typeof createWalletClient>;
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
  const sourceState = await getSourceBridgeState(requiredAmount);
  if (!sourceState) {
    return null;
  }

  return sourceState;
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
  const requiredAmount = amountToUsdcSubunits(params.amountUSDC);
  const sourceState = await getSourceBridgeState(requiredAmount);
  if (!sourceState) {
    throw new Error("Connect your Circle passkey wallet or a supported injected wallet to bridge USDC.");
  }

  if (sourceState.wallet !== params.sourceWallet) {
    throw new Error("The active source wallet changed. Refresh and try again.");
  }

  const publicClient = createPublicClient({
    chain: cctpBaseSepoliaChain,
    transport: cctpBaseSepoliaTransport,
  });

  if (sourceState.nativeGasBalance === BigInt(0)) {
    throw new Error(
      "You have Base Sepolia USDC, but you need Base Sepolia ETH to pay gas for the bridge transaction.",
    );
  }

  if (sourceState.kind === "injected") {
    if (!sourceState.provider) {
      throw new Error("Injected wallet provider is unavailable.");
    }

    await ensureSourceChain(sourceState.provider);
  }

  params.onStep?.("preparing");

  const requiredBurnAmount = BigInt(params.quote.totalBurnAmount);
  const hasAllowance = sourceState.allowance >= requiredBurnAmount;

  if (!hasAllowance) {
    params.onStep?.("approving");
    const approveTxHash = await sourceState.walletClient.sendTransaction({
      account: sourceState.walletClient.account!,
      chain: cctpBaseSepoliaChain,
      to: sourceChain.usdcAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [
          sourceChain.tokenMessengerV2 as Address,
          requiredBurnAmount,
        ],
      }),
    });
    const approvalReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveTxHash,
    });

    if (approvalReceipt.status !== "success") {
      throw new Error("USDC approval transaction failed.");
    }

    const postApprovalAllowance = await publicClient.readContract({
      address: sourceChain.usdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [sourceState.wallet, sourceChain.tokenMessengerV2 as Address],
    });

    if (postApprovalAllowance < requiredBurnAmount) {
      throw new Error("USDC approval did not complete. Try again.");
    }
  }

  params.onStep?.("bridging");
  const sourceTxHash = await sourceState.walletClient.sendTransaction({
    account: sourceState.walletClient.account!,
    chain: cctpBaseSepoliaChain,
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
  const bridgeReceipt = await publicClient.waitForTransactionReceipt({
    hash: sourceTxHash,
  });

  if (bridgeReceipt.status !== "success") {
    throw new Error("CCTP bridge transaction failed.");
  }
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

async function resolveSourceWallet(): Promise<SourceWalletContext | null> {
  const storedSession = getStoredWalletSession();
  if (storedSession) {
    return createCircleSourceWallet(storedSession);
  }

  const provider = getEthereumProvider();
  if (!provider) {
    return null;
  }

  const address = await getInjectedWalletAddress(provider);
  if (!address) {
    return null;
  }

  const walletClient = createWalletClient({
    chain: cctpBaseSepoliaChain,
    transport: custom(provider),
    account: address,
  });

  return {
    kind: "injected",
    account: address,
    address,
    provider,
    walletClient,
  };
}

export async function getSourceBridgeState(
  requiredAmount: bigint,
): Promise<SourceBridgeState | null> {
  const sourceWallet = await resolveSourceWallet();
  if (!sourceWallet) {
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
    args: [sourceWallet.address],
  });

  if (balance < requiredAmount) {
    return null;
  }

  const nativeGasBalance = await publicClient.getBalance({
    address: sourceWallet.address,
  });

  if (nativeGasBalance === BigInt(0)) {
    throw new Error(
      "You have Base Sepolia USDC, but you need Base Sepolia ETH to pay gas for the bridge transaction.",
    );
  }

  const allowance = await publicClient.readContract({
    address: sourceChain.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [sourceWallet.address, sourceChain.tokenMessengerV2 as Address],
  });

  return {
    sourceKey,
    chainName: sourceChain.name,
    wallet: sourceWallet.address,
    balance,
    balanceUSDC: Number(formatUnits(balance, 6)),
    kind: sourceWallet.kind,
    walletClient: sourceWallet.walletClient,
    nativeGasBalance,
    allowance,
    needsApproval: allowance < BigInt(requiredAmount),
    provider: sourceWallet.kind === "injected" ? sourceWallet.provider : undefined,
  };
}

function createCircleSourceWallet(
  storedSession: StoredWalletSession,
): SourceWalletContext {
  const { clientKey, clientUrl } = getClientEnv();
  const passkeyWalletClient = createWalletClient({
    transport: toPasskeyTransport(clientUrl, clientKey),
    account: storedSession.address,
  });
  const account = walletClientToLocalAccount(passkeyWalletClient);

  const walletClient = createWalletClient({
    chain: cctpBaseSepoliaChain,
    transport: cctpBaseSepoliaTransport,
    account,
  });

  return {
    kind: "circle",
    account: getAddress(account.address) as Address,
    address: getAddress(account.address) as Address,
    walletClient,
  };
}

async function getInjectedWalletAddress(provider: EthereumProvider) {
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  const existingAccount = accounts[0];
  if (existingAccount) {
    return getAddress(existingAccount) as Address;
  }

  const requested = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = requested[0];

  return account ? (getAddress(account) as Address) : null;
}

function getEthereumProvider(): EthereumProvider | null {
  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return ethereum ?? null;
}

function getClientEnv() {
  const clientKey = process.env.NEXT_PUBLIC_CLIENT_KEY;
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL;

  if (!clientKey || !clientUrl) {
    throw new Error("Missing NEXT_PUBLIC_CLIENT_KEY or NEXT_PUBLIC_CLIENT_URL.");
  }

  return { clientKey, clientUrl };
}

function isWalletMissingChainError(error: unknown) {
  const maybeError = error as { code?: number };
  return maybeError?.code === 4902;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
