import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  decodeEventLog,
  getAddress,
  parseAbi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { arcPublicClient } from "@/lib/circle";
import { InputError, usdcAmountToString } from "@/lib/validation";

const erc20TransferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export type SettlementVerificationStatus =
  | "PENDING"
  | "CONFIRMING"
  | "SETTLED"
  | "FAILED";

export type SettlementVerificationResult = {
  status: SettlementVerificationStatus;
  settled: boolean;
  reason: string;
  txHash: Hash;
  chainId?: number;
  blockNumber?: string;
  confirmations?: string;
  transfer?: {
    from: Address;
    to: Address;
    value: string;
    expectedValue: string;
    token: Address;
  };
};

export async function verifySettlement(params: {
  txHash: Hash;
  payerWallet: Address;
  providerWallet: Address;
  amountUSDC: number;
}): Promise<SettlementVerificationResult> {
  const expectedAmount = parseUnits(usdcAmountToString(params.amountUSDC), 6);
  const expectedFrom = getAddress(params.payerWallet);
  const expectedTo = getAddress(params.providerWallet);
  const usdcAddress = getAddress(ArcTestnet.usdcAddress);
  const requiredConfirmations = getRequiredConfirmations();

  const chainId = await arcPublicClient.getChainId();
  if (chainId !== ArcTestnet.chainId) {
    return failed(params.txHash, "RPC endpoint is not Arc Testnet", { chainId });
  }

  const receipt = await arcPublicClient
    .getTransactionReceipt({ hash: params.txHash })
    .catch(() => null);

  if (!receipt) {
    return {
      status: "PENDING",
      settled: false,
      reason: "transaction receipt not found on Arc Testnet",
      txHash: params.txHash,
      chainId,
    };
  }

  if (receipt.status !== "success") {
    return failed(params.txHash, "transaction reverted on Arc Testnet", {
      chainId,
      blockNumber: receipt.blockNumber?.toString(),
    });
  }

  const latestBlock = await arcPublicClient.getBlockNumber();
  const confirmations = latestBlock - receipt.blockNumber + 1n;
  if (confirmations < requiredConfirmations) {
    return {
      status: "CONFIRMING",
      settled: false,
      reason: "transaction exists but has not reached Arc finality",
      txHash: params.txHash,
      chainId,
      blockNumber: receipt.blockNumber.toString(),
      confirmations: confirmations.toString(),
    };
  }

  const matchingTransfer = receipt.logs.find((log) => {
    if (getAddress(log.address) !== usdcAddress) {
      return false;
    }

    try {
      const decoded = decodeEventLog({
        abi: erc20TransferAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Transfer") {
        return false;
      }

      const from = getAddress(decoded.args.from);
      const to = getAddress(decoded.args.to);
      const value = decoded.args.value;

      return from === expectedFrom && to === expectedTo && value === expectedAmount;
    } catch {
      return false;
    }
  });

  if (!matchingTransfer) {
    return failed(params.txHash, "matching Arc USDC transfer was not found", {
      chainId,
      blockNumber: receipt.blockNumber.toString(),
      confirmations: confirmations.toString(),
    });
  }

  const decoded = decodeEventLog({
    abi: erc20TransferAbi,
    data: matchingTransfer.data,
    topics: matchingTransfer.topics,
  });

  if (decoded.eventName !== "Transfer") {
    throw new InputError("unexpected decoded transfer event");
  }

  return {
    status: "SETTLED",
    settled: true,
    reason: "Arc Testnet USDC transfer is finalized",
    txHash: params.txHash,
    chainId,
    blockNumber: receipt.blockNumber.toString(),
    confirmations: confirmations.toString(),
    transfer: {
      from: getAddress(decoded.args.from),
      to: getAddress(decoded.args.to),
      value: decoded.args.value.toString(),
      expectedValue: expectedAmount.toString(),
      token: usdcAddress,
    },
  };
}

function getRequiredConfirmations() {
  const cctpConfirmations = ArcTestnet.cctp?.contracts.v2?.confirmations ?? 1;
  return BigInt(Math.max(cctpConfirmations, 1));
}

function failed(
  txHash: Hash,
  reason: string,
  extra?: Partial<SettlementVerificationResult>,
): SettlementVerificationResult {
  return {
    status: "FAILED",
    settled: false,
    reason,
    txHash,
    ...extra,
  };
}
