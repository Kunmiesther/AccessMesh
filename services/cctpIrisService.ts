import {
  CCTP_FINALITY_THRESHOLD_FAST,
  cctpDestinationChain,
  cctpIrisApiBase,
  cctpSourceChains,
  type SupportedCctpSourceKey,
} from "@/lib/cctp-config";
import { InputError, normalizeTxHash } from "@/lib/validation";

type FeeQuote = {
  finalityThreshold: number;
  minimumFee: number | string;
  forwardFee?: {
    med?: number | string;
  };
};

type IrisMessage = {
  message?: string;
  attestation?: string;
  status?: string;
  forwardTxHash?: string;
};

export async function getForwardingQuote(params: {
  sourceKey: SupportedCctpSourceKey;
  amount: bigint;
}) {
  if (params.amount <= BigInt(0)) {
    throw new InputError("amount must be positive");
  }

  const source = cctpSourceChains[params.sourceKey];
  if (!source) {
    throw new InputError("unsupported CCTP source chain");
  }

  const url = `${normalizeBaseUrl(cctpIrisApiBase)}/v2/burn/USDC/fees/${source.domain}/${cctpDestinationChain.domain}?forward=true`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CCTP fees: ${await response.text()}`);
  }

  const fees = (await response.json()) as FeeQuote[];
  const feeData = fees.find(
    (fee) => fee.finalityThreshold === CCTP_FINALITY_THRESHOLD_FAST,
  );

  if (!feeData?.forwardFee?.med) {
    throw new Error("Fast-transfer forwarding fees are not available.");
  }

  const forwardFee = BigInt(feeData.forwardFee.med);
  const minimumFee = Number(feeData.minimumFee);

  if (!Number.isFinite(minimumFee) || minimumFee < 0) {
    throw new Error("CCTP fee response was invalid.");
  }

  const protocolFee =
    (params.amount * BigInt(Math.round(minimumFee * 100))) / BigInt(1_000_000);
  const maxFee = forwardFee + protocolFee;
  const totalBurnAmount = params.amount + maxFee;

  return {
    sourceChain: {
      key: source.key,
      name: source.name,
      chainId: source.chainId,
      domain: source.domain,
    },
    destinationChain: {
      key: cctpDestinationChain.key,
      name: cctpDestinationChain.name,
      chainId: cctpDestinationChain.chainId,
      domain: cctpDestinationChain.domain,
    },
    amount: params.amount.toString(),
    maxFee: maxFee.toString(),
    totalBurnAmount: totalBurnAmount.toString(),
    feeUSDC: Number(maxFee) / 1_000_000,
    totalBurnUSDC: Number(totalBurnAmount) / 1_000_000,
    finalityThreshold: CCTP_FINALITY_THRESHOLD_FAST,
    estimatedCompletion: source.estimatedCompletion,
  };
}

export async function getForwardedMintMessage(params: {
  sourceKey: SupportedCctpSourceKey;
  transactionHash: string;
}) {
  const source = cctpSourceChains[params.sourceKey];
  if (!source) {
    throw new InputError("unsupported CCTP source chain");
  }

  const txHash = normalizeTxHash(params.transactionHash);
  const url = `${normalizeBaseUrl(cctpIrisApiBase)}/v2/messages/${source.domain}?transactionHash=${txHash}`;
  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    return {
      found: false,
      status: response.status,
      forwardTxHash: null,
    };
  }

  const data = (await response.json()) as { messages?: IrisMessage[] };
  const message = data.messages?.[0];

  return {
    found: Boolean(message),
    status: message?.status ?? "pending",
    forwardTxHash: message?.forwardTxHash ?? null,
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}
