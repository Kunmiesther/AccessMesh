import type { AgentBudgetPolicy } from "./types";

export function evaluateAgentBudgetPolicy(params: {
  resourcePriceUSDC: number;
  policy: AgentBudgetPolicy;
  goalMaximumPriceUSDC?: number;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const price = params.resourcePriceUSDC;
  const { policy } = params;
  const goalMaximumPriceUSDC = params.goalMaximumPriceUSDC;

  if (!(price > 0)) {
    return {
      eligible: false,
      reasons: ["Resource price must be greater than 0 USDC."],
    };
  }

  if (price > policy.maxPurchaseUSDC) {
    reasons.push(
      `Rejected: price ${formatUsdc(price)} exceeds max purchase limit ${formatUsdc(policy.maxPurchaseUSDC)}.`,
    );
  }

  if (price > policy.remainingBudgetUSDC) {
    reasons.push(
      `Rejected: price ${formatUsdc(price)} exceeds remaining budget ${formatUsdc(policy.remainingBudgetUSDC)}.`,
    );
  }

  if (
    typeof goalMaximumPriceUSDC === "number" &&
    Number.isFinite(goalMaximumPriceUSDC) &&
    price > goalMaximumPriceUSDC
  ) {
    reasons.push(
      `Rejected: price ${formatUsdc(price)} exceeds goal maximum ${formatUsdc(goalMaximumPriceUSDC)}.`,
    );
  }

  if (reasons.length > 0) {
    return {
      eligible: false,
      reasons,
    };
  }

  return {
    eligible: true,
    reasons: [
      `Price ${formatUsdc(price)} is within all budget limits.`,
    ],
  };
}

function formatUsdc(value: number) {
  return `${trimTrailingZeros(value.toFixed(2))} USDC`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.?0+$/, "");
}
