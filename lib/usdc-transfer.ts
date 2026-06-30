"use client";

import { ArcTestnet } from "@circle-fin/app-kit/chains";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import type { ModularWalletSession } from "@/lib/modular-wallet";

export async function executeUsdcPayment(params: {
  bundlerClient: ModularWalletSession["bundlerClient"];
  transfers: Array<{
    recipientWallet: Address;
    amountUSDC: number;
  }>;
}): Promise<Hash> {
  const calls = params.transfers
    .filter((transfer) => transfer.amountUSDC > 0)
    .map((transfer) =>
      buildTransferCall(transfer.recipientWallet, transfer.amountUSDC),
    );

  if (calls.length === 0) {
    throw new Error("USDC payment requires at least one positive transfer.");
  }

  const userOpHash = await params.bundlerClient.sendUserOperation({ calls });

  const receipt = await params.bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 120_000,
  });

  if (!receipt.success) {
    throw new Error(receipt.reason ?? "USDC payment user operation reverted.");
  }

  return receipt.receipt.transactionHash;
}

function buildTransferCall(recipientWallet: Address, amountUSDC: number) {
  return {
    to: ArcTestnet.usdcAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientWallet, parseUnits(amountUSDC.toString(), 6)],
    }),
    value: BigInt(0),
  };
}
