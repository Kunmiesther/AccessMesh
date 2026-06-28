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
  transfers: Array<{
    recipientWallet: Address;
    amountUSDC: number;
  }>;
}): Promise<SettlementVerificationResult> {
  const expectedFrom = getAddress(params.payerWallet);
  const usdcAddress = getAddress(ArcTestnet.usdcAddress);
  const requiredConfirmations = getRequiredConfirmations();
  const expectedTransfers = params.transfers
    .filter((transfer) => transfer.amountUSDC > 0)
    .map((transfer) => ({
      to: getAddress(transfer.recipientWallet),
      amount: parseUnits(usdcAmountToString(transfer.amountUSDC), 6),
    }));

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
  const confirmations = latestBlock - receipt.blockNumber + BigInt(1);
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

  const matchingTransfers = expectedTransfers.filter((expectedTransfer) => {
    return receipt.logs.some((log) => {
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

        return from === expectedFrom && to === expectedTransfer.to && value === expectedTransfer.amount;
      } catch {
        return false;
      }
    });
  });

  if (matchingTransfers.length !== expectedTransfers.length) {
    return failed(params.txHash, "matching Arc USDC transfer was not found", {
      chainId,
      blockNumber: receipt.blockNumber.toString(),
      confirmations: confirmations.toString(),
    });
  }

  const primaryLog = receipt.logs.find((log) => {
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
      return from === expectedFrom;
    } catch {
      return false;
    }
  });

  const decoded = primaryLog
    ? decodeEventLog({
        abi: erc20TransferAbi,
        data: primaryLog.data,
        topics: primaryLog.topics,
      })
    : null;

  return {
    status: "SETTLED",
    settled: true,
    reason: "Arc Testnet USDC transfer is finalized",
    txHash: params.txHash,
    chainId,
    blockNumber: receipt.blockNumber.toString(),
    confirmations: confirmations.toString(),
    transfer: {
      from: getAddress(decoded?.args.from ?? expectedFrom),
      to: getAddress(decoded?.args.to ?? expectedTransfers[0].to),
      value: decoded?.args.value.toString() ?? expectedTransfers[0].amount.toString(),
      expectedValue: expectedTransfers[0].amount.toString(),
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
