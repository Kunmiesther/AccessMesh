import { type Address } from "viem";
import { getTreasuryWallet } from "@/services/paymentSplit";
import { verifySettlement } from "@/services/arcVerifier";
import {
  InputError,
  normalizeAddress,
  normalizeTxHash,
  parsePositiveUsdcAmount,
} from "@/lib/validation";

export function getPublishFeeUSDC() {
  const rawFee = process.env.ACCESSMESH_PUBLISH_FEE_USDC;
  if (!rawFee) {
    throw new InputError("AccessMesh publish fee is not configured");
  }

  return parsePositiveUsdcAmount(rawFee);
}

export function getPublishFeeTreasuryWallet() {
  const treasuryWallet = getTreasuryWallet();
  if (!treasuryWallet) {
    throw new InputError("AccessMesh treasury wallet is not configured");
  }

  return treasuryWallet;
}

export function getPublishFeeConfig() {
  return {
    publishFeeUSDC: getPublishFeeUSDC(),
    treasuryWallet: getPublishFeeTreasuryWallet(),
  };
}

export async function verifyPublishFeePayment(params: {
  txHash: unknown;
  creatorWallet: unknown;
}) {
  const txHash = normalizeTxHash(params.txHash);
  const creatorWallet = normalizeAddress(params.creatorWallet, "creatorWallet");
  const { publishFeeUSDC, treasuryWallet } = getPublishFeeConfig();

  const verification = await verifySettlement({
    txHash,
    payerWallet: creatorWallet as Address,
    transfers: [
      {
        recipientWallet: treasuryWallet as Address,
        amountUSDC: publishFeeUSDC,
      },
    ],
  });

  return {
    txHash,
    publishFeeUSDC,
    treasuryWallet,
    verification,
  };
}
