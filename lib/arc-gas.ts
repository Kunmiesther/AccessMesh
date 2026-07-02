import { parseGwei, type PublicClient } from "viem";
import { arcPublicClient } from "@/lib/circle";

export const ARC_MIN_PRIORITY_FEE_PER_GAS = parseGwei("1");

export async function getArcUserOperationGasFees(
  publicClient: PublicClient = arcPublicClient,
) {
  const estimatedFees = await publicClient.estimateFeesPerGas();
  const estimatedPriority = estimatedFees.maxPriorityFeePerGas ?? BigInt(0);
  const maxPriorityFeePerGas =
    estimatedPriority < ARC_MIN_PRIORITY_FEE_PER_GAS
      ? ARC_MIN_PRIORITY_FEE_PER_GAS
      : estimatedPriority;

  const estimatedMaxFee = estimatedFees.maxFeePerGas ?? maxPriorityFeePerGas;
  const maxFeePerGas =
    estimatedMaxFee < maxPriorityFeePerGas ? maxPriorityFeePerGas : estimatedMaxFee;

  return {
    maxPriorityFeePerGas,
    maxFeePerGas,
  } as const;
}
