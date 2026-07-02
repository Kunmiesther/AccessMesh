"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  pad,
  type Address,
  type Hash,
} from "viem";
import {
  createBundlerClient,
  toWebAuthnAccount,
} from "viem/account-abstraction";
import {
  CCTP_EMPTY_DESTINATION_CALLER,
  CCTP_FINALITY_THRESHOLD_FAST,
  CCTP_FORWARDING_HOOK_DATA,
  cctpArcTestnetChain,
  cctpArcTestnetTransport,
  cctpDestinationChain,
  getCctpModularTransportUrl,
  getDefaultSupportedCctpSourceChain,
  getSupportedCctpSourceChain,
  getSupportedCctpSourceChainByChainId,
  supportedCctpSources,
  type CctpChainConfig,
  type SupportedCctpSourceChainConfig,
  type SupportedCctpSourceKey,
} from "@/lib/cctp-config";
import {
  getStoredWalletSession,
  type StoredWalletSession,
} from "@/lib/modular-wallet";
import {
  toCircleSmartAccount,
  toModularTransport,
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
  sourceChain: SupportedCctpSourceChainConfig;
  activeChainId: number | null;
  transportTarget: string;
  walletClient?: ReturnType<typeof createWalletClient>;
  smartAccount?: Awaited<ReturnType<typeof toCircleSmartAccount>>;
  bundlerClient?: ReturnType<typeof createBundlerClient>;
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
      sourceChain: SupportedCctpSourceChainConfig;
      activeChainId: number | null;
      transportTarget: string;
      smartAccount: Awaited<ReturnType<typeof toCircleSmartAccount>>;
      bundlerClient: ReturnType<typeof createBundlerClient>;
    }
  | {
      kind: "injected";
      account: Address;
      address: Address;
      sourceChain: SupportedCctpSourceChainConfig;
      activeChainId: number | null;
      transportTarget: string;
      provider: EthereumProvider;
      walletClient: ReturnType<typeof createWalletClient>;
      smartAccount?: undefined;
      bundlerClient?: undefined;
    };

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
  sourceKey?: SupportedCctpSourceKey,
): Promise<SourceUsdcBalance | null> {
  const sourceState = await getSourceBridgeState(requiredAmount, sourceKey);
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
  sourceKey: SupportedCctpSourceKey;
  sourceWallet: Address;
  destinationAddress: Address;
  amountUSDC: number;
  quote: CctpQuote;
  onStep?: (step: "preparing" | "approving" | "bridging" | "receiving") => void;
  onSourceTx?: (sourceTxHash: Hash) => Promise<void> | void;
}) {
  const requiredAmount = amountToUsdcSubunits(params.amountUSDC);
  const sourceState = await getSourceBridgeState(requiredAmount, params.sourceKey);
  if (!sourceState) {
    throw new Error(
      "Connect your Circle passkey wallet or a supported injected wallet to bridge USDC.",
    );
  }

  if (sourceState.sourceKey !== params.sourceKey) {
    throw new Error(
      `Selected source chain mismatch. Expected ${getSupportedCctpSourceChain(params.sourceKey).name}, but the active wallet resolved to ${sourceState.chainName}.`,
    );
  }

  if (sourceState.wallet !== params.sourceWallet) {
    throw new Error("The active source wallet changed. Refresh and try again.");
  }

  if (sourceState.nativeGasBalance === BigInt(0)) {
    throw new Error(
      `You have ${sourceState.chainName} USDC, but you need ${sourceState.chainName} ETH to pay gas for the bridge transaction.`,
    );
  }

  params.onStep?.("preparing");

  const sourcePublicClient = getSourcePublicClient(sourceState.sourceChain);
  const requiredBurnAmount = BigInt(params.quote.totalBurnAmount);
  const hasAllowance = sourceState.allowance >= requiredBurnAmount;

  if (!hasAllowance) {
    params.onStep?.("approving");
    const approvalReceipt = await sendSourceApproval({
      sourceState,
      sourceChain: sourceState.sourceChain,
      publicClient: sourcePublicClient,
      requiredBurnAmount,
    });

    if (approvalReceipt.status !== "success") {
      throw new Error("USDC approval transaction failed.");
    }

    const postApprovalAllowance = await sourcePublicClient.readContract({
      address: sourceState.sourceChain.usdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [sourceState.wallet, sourceState.sourceChain.tokenMessengerV2 as Address],
    });

    if (postApprovalAllowance < requiredBurnAmount) {
      throw new Error("USDC approval did not complete. Try again.");
    }
  }

  params.onStep?.("bridging");
  const sourceTxHash = await sendSourceBridge({
    sourceState,
    sourceChain: sourceState.sourceChain,
    publicClient: sourcePublicClient,
    destinationAddress: params.destinationAddress,
    burnAmount: requiredBurnAmount,
    maxFee: BigInt(params.quote.maxFee),
  });
  await params.onSourceTx?.(sourceTxHash);

  params.onStep?.("receiving");
  const destinationTxHash = await waitForForwardedMint({
    sourceKey: params.sourceKey,
    sourceTxHash,
  });

  return {
    sourceKey: params.sourceKey,
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

async function resolveSourceWallet(
  sourceKey?: SupportedCctpSourceKey,
): Promise<SourceWalletContext | null> {
  const storedSession = getStoredWalletSession();
  if (storedSession) {
    const sourceChain = resolveSourceChain({ sourceKey });
    if (!sourceChain) {
      throw new Error("No supported CCTP source chain is configured.");
    }

    return await createCircleSourceWallet(storedSession, sourceChain);
  }

  const provider = getEthereumProvider();
  if (!provider) {
    return null;
  }

  const address = await getInjectedWalletAddress(provider);
  if (!address) {
    return null;
  }

  const activeChainId = await getProviderChainId(provider);
  if (activeChainId == null) {
    throw new Error("Unable to determine the connected wallet chain.");
  }

  const sourceChain = resolveSourceChain({ sourceKey, activeChainId });
  if (!sourceChain) {
    throw new Error(
      `Unsupported source chain. Connect ${getSupportedSourceChainNames()} to bridge USDC.`,
    );
  }

  if (activeChainId !== sourceChain.chainId) {
    throw new Error(
      `Source chain mismatch. Expected ${sourceChain.name} (${sourceChain.chainId}), but the connected wallet is on ${formatChainId(activeChainId)}.`,
    );
  }

  const walletClient = createWalletClient({
    chain: sourceChain.chain,
    transport: custom(provider),
    account: address,
  });

  return {
    kind: "injected",
    account: address,
    address,
    provider,
    walletClient,
    sourceChain,
    activeChainId,
    transportTarget: "injected",
  };
}

export async function getSourceBridgeState(
  requiredAmount: bigint,
  sourceKey?: SupportedCctpSourceKey,
): Promise<SourceBridgeState | null> {
  const sourceWallet = await resolveSourceWallet(sourceKey);
  if (!sourceWallet) {
    return null;
  }

  const sourceChain = sourceWallet.sourceChain;
  const publicClient = getSourcePublicClient(sourceChain);

  if (sourceWallet.kind === "injected") {
    await assertInjectedWalletChain(sourceWallet.provider, sourceChain);
  }

  await assertSourceTransportTarget({
    sourceWallet,
    sourceChain,
    publicClient,
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
      `You have ${sourceChain.name} USDC, but you need ${sourceChain.name} ETH to pay gas for the bridge transaction.`,
    );
  }

  const allowance = await publicClient.readContract({
    address: sourceChain.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [sourceWallet.address, sourceChain.tokenMessengerV2 as Address],
  });

  return {
    sourceKey: sourceChain.key as SupportedCctpSourceKey,
    chainName: sourceChain.name,
    wallet: sourceWallet.address,
    balance,
    balanceUSDC: Number(formatUnits(balance, 6)),
    kind: sourceWallet.kind,
    sourceChain,
    activeChainId: sourceWallet.activeChainId,
    transportTarget: sourceWallet.transportTarget,
    walletClient: sourceWallet.kind === "injected" ? sourceWallet.walletClient : undefined,
    smartAccount: sourceWallet.kind === "circle" ? sourceWallet.smartAccount : undefined,
    bundlerClient: sourceWallet.kind === "circle" ? sourceWallet.bundlerClient : undefined,
    nativeGasBalance,
    allowance,
    needsApproval: allowance < requiredAmount,
    provider: sourceWallet.kind === "injected" ? sourceWallet.provider : undefined,
  };
}

async function createCircleSourceWallet(
  storedSession: StoredWalletSession,
  sourceChain: SupportedCctpSourceChainConfig,
): Promise<SourceWalletContext> {
  const { clientKey, clientUrl } = getClientEnv();
  const modularTransportUrl = getCctpModularTransportUrl(clientUrl, sourceChain);
  const modularTransport = toModularTransport(modularTransportUrl, clientKey);
  const owner = toWebAuthnAccount({
    credential: {
      id: storedSession.credentialId,
      publicKey: storedSession.credentialPublicKey,
    },
    rpId: storedSession.rpId,
  });
  const publicClient = createPublicClient({
    chain: sourceChain.chain,
    transport: modularTransport,
  });
  const smartAccount = await toCircleSmartAccount({
    client: publicClient,
    owner,
    name: storedSession.username,
  });
  const bundlerClient = createBundlerClient({
    account: smartAccount,
    chain: sourceChain.chain,
    client: publicClient,
    transport: modularTransport,
    paymaster: true,
  });

  return {
    kind: "circle",
    account: storedSession.address,
    address: storedSession.address,
    sourceChain,
    activeChainId: sourceChain.chainId,
    transportTarget: modularTransportUrl,
    smartAccount,
    bundlerClient,
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

function resolveSourceChain(params: {
  sourceKey?: SupportedCctpSourceKey;
  activeChainId?: number | null;
}): SupportedCctpSourceChainConfig | null {
  if (params.sourceKey) {
    return getSupportedCctpSourceChain(params.sourceKey);
  }

  if (typeof params.activeChainId === "number") {
    return getSupportedCctpSourceChainByChainId(params.activeChainId);
  }

  return getDefaultSupportedCctpSourceChain();
}

function getSupportedSourceChainNames() {
  return supportedCctpSources.map((chain) => chain.name).join(", ");
}

function getSourcePublicClient(sourceChain: SupportedCctpSourceChainConfig) {
  return createPublicClient({
    chain: sourceChain.chain,
    transport: http(sourceChain.rpcUrls[0]),
  });
}

async function assertInjectedWalletChain(
  provider: EthereumProvider,
  sourceChain: SupportedCctpSourceChainConfig,
) {
  const activeChainId = await getProviderChainId(provider);
  if (activeChainId !== sourceChain.chainId) {
    throw new Error(
      `Source chain mismatch. Expected ${sourceChain.name} (${sourceChain.chainId}), but the connected wallet is on ${formatChainId(activeChainId)}.`,
    );
  }
}

async function assertSourceTransportTarget(params: {
  sourceWallet: SourceWalletContext;
  sourceChain: SupportedCctpSourceChainConfig;
  publicClient: ReturnType<typeof createPublicClient>;
}) {
  if (params.publicClient.chain?.id !== params.sourceChain.chainId) {
    throw new Error(
      `Source client mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}), but the client was built for ${formatChainId(params.publicClient.chain?.id ?? null)}.`,
    );
  }

  if (params.sourceWallet.kind === "circle") {
    if (params.sourceWallet.transportTarget !== getCctpModularTransportUrl(getClientEnv().clientUrl, params.sourceChain)) {
      throw new Error(
        `Circle transport mismatch. Expected the ${params.sourceChain.name} modular transport path.`,
      );
    }

    if (params.sourceWallet.bundlerClient.chain?.id !== params.sourceChain.chainId) {
      throw new Error(
        `Circle bundler mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}).`,
      );
    }
    return;
  }

  if (params.sourceWallet.walletClient.chain?.id !== params.sourceChain.chainId) {
    throw new Error(
      `Injected wallet client mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}).`,
    );
  }
}

async function getProviderChainId(provider: EthereumProvider) {
  const chainId = (await provider.request({
    method: "eth_chainId",
  })) as string | number | null;

  if (typeof chainId === "number") {
    return chainId;
  }

  if (typeof chainId === "string" && /^0x[0-9a-fA-F]+$/.test(chainId)) {
    return Number(BigInt(chainId));
  }

  return null;
}

function formatChainId(chainId: number | null | undefined) {
  return typeof chainId === "number" ? `${chainId}` : "unknown";
}

function getCctpExpectedTransportTarget(sourceChain: CctpChainConfig) {
  const { clientUrl } = getClientEnv();
  return getCctpModularTransportUrl(clientUrl, sourceChain);
}

async function sendSourceApproval(params: {
  sourceState: SourceBridgeState;
  sourceChain: SupportedCctpSourceChainConfig;
  publicClient: ReturnType<typeof createPublicClient>;
  requiredBurnAmount: bigint;
}) {
  await assertSourceTxContext({
    sourceState: params.sourceState,
    sourceChain: params.sourceChain,
    publicClient: params.publicClient,
  });

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [params.sourceChain.tokenMessengerV2 as Address, params.requiredBurnAmount],
  });

  if (params.sourceState.kind === "circle") {
    if (!params.sourceState.bundlerClient) {
      throw new Error(
        "Circle passkey wallet is not ready for source-chain bridging.",
      );
    }

    const userOpHash = await params.sourceState.bundlerClient.sendUserOperation({
      calls: [
        {
          to: params.sourceChain.usdcAddress,
          data: approveData,
          value: BigInt(0),
        },
      ],
    });

    const receipt = await params.sourceState.bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    if (!receipt.success) {
      throw new Error(receipt.reason ?? "USDC approval transaction failed.");
    }

    return receipt.receipt;
  }

  if (!params.sourceState.walletClient) {
    throw new Error("Injected wallet is not available for source-chain bridging.");
  }

  const approveTxHash = await params.sourceState.walletClient.sendTransaction({
    account: params.sourceState.walletClient.account!,
    chain: params.sourceChain.chain,
    to: params.sourceChain.usdcAddress,
    data: approveData,
  });

  return params.publicClient.waitForTransactionReceipt({ hash: approveTxHash });
}

async function sendSourceBridge(params: {
  sourceState: SourceBridgeState;
  sourceChain: SupportedCctpSourceChainConfig;
  publicClient: ReturnType<typeof createPublicClient>;
  destinationAddress: Address;
  burnAmount: bigint;
  maxFee: bigint;
}) {
  await assertSourceTxContext({
    sourceState: params.sourceState,
    sourceChain: params.sourceChain,
    publicClient: params.publicClient,
  });

  const bridgeData = encodeFunctionData({
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
      params.burnAmount,
      cctpDestinationChain.domain,
      pad(params.destinationAddress, { size: 32 }),
      params.sourceChain.usdcAddress,
      CCTP_EMPTY_DESTINATION_CALLER,
      params.maxFee,
      CCTP_FINALITY_THRESHOLD_FAST,
      CCTP_FORWARDING_HOOK_DATA,
    ],
  });

  if (params.sourceState.kind === "circle") {
    if (!params.sourceState.bundlerClient) {
      throw new Error(
        "Circle passkey wallet is not ready for source-chain bridging.",
      );
    }

    const userOpHash = await params.sourceState.bundlerClient.sendUserOperation({
      calls: [
        {
          to: params.sourceChain.tokenMessengerV2 as Address,
          data: bridgeData,
          value: BigInt(0),
        },
      ],
    });

    const receipt = await params.sourceState.bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    if (!receipt.success) {
      throw new Error(receipt.reason ?? "CCTP bridge transaction failed.");
    }

    return receipt.receipt.transactionHash;
  }

  if (!params.sourceState.walletClient) {
    throw new Error("Injected wallet is not available for source-chain bridging.");
  }

  const sourceTxHash = await params.sourceState.walletClient.sendTransaction({
    account: params.sourceState.walletClient.account!,
    chain: params.sourceChain.chain,
    to: params.sourceChain.tokenMessengerV2 as Address,
    data: bridgeData,
  });

  const bridgeReceipt = await params.publicClient.waitForTransactionReceipt({
    hash: sourceTxHash,
  });

  if (bridgeReceipt.status !== "success") {
    throw new Error("CCTP bridge transaction failed.");
  }

  return sourceTxHash;
}

async function assertSourceTxContext(params: {
  sourceState: SourceBridgeState;
  sourceChain: SupportedCctpSourceChainConfig;
  publicClient: ReturnType<typeof createPublicClient>;
}) {
  if (params.sourceState.sourceKey !== (params.sourceChain.key as SupportedCctpSourceKey)) {
    throw new Error(
      `Selected source chain mismatch. Expected ${params.sourceChain.name}, but the active wallet resolved to ${params.sourceState.chainName}.`,
    );
  }

  if (params.sourceState.sourceChain.chainId !== params.sourceChain.chainId) {
    throw new Error(
      `Source chain mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}), but the active wallet resolved to ${params.sourceState.sourceChain.name} (${params.sourceState.sourceChain.chainId}).`,
    );
  }

  if (params.publicClient.chain?.id !== params.sourceChain.chainId) {
    throw new Error(
      `Source client mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}), but the client was built for ${formatChainId(params.publicClient.chain?.id ?? null)}.`,
    );
  }

  if (params.sourceState.activeChainId !== params.sourceChain.chainId) {
    throw new Error(
      `Source chain mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}), but the active client is on ${formatChainId(params.sourceState.activeChainId)}.`,
    );
  }

  if (params.sourceState.kind === "injected") {
    const activeChainId = await getProviderChainId(params.sourceState.provider!);
    if (activeChainId !== params.sourceChain.chainId) {
      throw new Error(
        `Source chain mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}), but the connected wallet is on ${formatChainId(activeChainId)}.`,
      );
    }

    if (params.sourceState.walletClient!.chain?.id !== params.sourceChain.chainId) {
      throw new Error(
        `Injected wallet client mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}).`,
      );
    }
    return;
  }

  const expectedTransportTarget = getCctpExpectedTransportTarget(params.sourceChain);
  if (params.sourceState.transportTarget !== expectedTransportTarget) {
    throw new Error(
      `Circle transport mismatch. Expected ${params.sourceChain.name} modular transport.`,
    );
  }

  if (params.sourceState.bundlerClient!.chain?.id !== params.sourceChain.chainId) {
    throw new Error(
      `Circle bundler mismatch. Expected ${params.sourceChain.name} (${params.sourceChain.chainId}).`,
    );
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
