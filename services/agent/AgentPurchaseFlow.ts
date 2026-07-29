import { type Address, type Hash } from "viem";
import { arcExplorerTxUrl } from "@/lib/ui";
import {
  postAgentExecutionFailure,
  postAgentExecutionCancelApproval,
  postAgentExecutionCancelPaymentPreparation,
  postAgentExecutionPreparePayment,
  postAgentExecutionPaymentSubmitted,
  postAgentExecutionSettlementVerification,
  postUnlock,
} from "@/lib/api";
import {
  confirmUsdcPayment,
  submitUsdcPayment,
  type UsdcBundlerClient,
} from "@/lib/usdc-transfer";
import type { AgentBudgetPolicy } from "@/services/agent/types";
import type {
  AgentPurchaseCompletionView,
  AgentRuntimeResultView,
} from "@/components/agent/types";
import type { PaymentIntent, UnlockResponse } from "@/types";

export type AgentPurchaseStage =
  | "IDLE"
  | "REVIEWING"
  | "AUTHENTICATING"
  | "PREPARING_PAYMENT"
  | "AWAITING_APPROVAL"
  | "SUBMITTING_PAYMENT"
  | "VERIFYING_SETTLEMENT"
  | "UNLOCKING_RESOURCE"
  | "COMPLETED"
  | "FAILED";

export type AgentPurchaseStageUpdate = {
  phase: AgentPurchaseStage;
  message: string;
};

export type AgentPurchaseFailureReason =
  | "RECOMMENDATION_INVALID"
  | "AUTHENTICATION_FAILED"
  | "PRICE_CHANGED"
  | "APPROVAL_REJECTED"
  | "INSUFFICIENT_BALANCE"
  | "DUPLICATE_SUBMISSION"
  | "PAYMENT_SUBMISSION_FAILED"
  | "SETTLEMENT_VERIFICATION_FAILED"
  | "UNLOCK_VERIFICATION_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type AgentPurchaseFailure = {
  ok: false;
  phase: "FAILED";
  reason: AgentPurchaseFailureReason;
  message: string;
};

export type AgentPurchaseSuccess = {
  ok: true;
  phase: "COMPLETED";
  completion: AgentPurchaseCompletionView;
  unlock: Extract<UnlockResponse, { ok: true }>;
};

export type AgentPurchaseResult = AgentPurchaseSuccess | AgentPurchaseFailure;

export type AgentPurchaseFlowInput = {
  result: AgentRuntimeResultView;
  policy: AgentBudgetPolicy;
  walletAddress: Address | null;
  bundlerClient: UsdcBundlerClient | null;
  accessIntent: PaymentIntent | null;
  executionId?: string | null;
  onStage?: (stage: AgentPurchaseStageUpdate) => void;
  preparePayment?: (executionId: string) => Promise<unknown>;
  cancelPaymentPreparation?: (executionId: string) => Promise<unknown>;
  submitPayment?: typeof submitUsdcPayment;
  confirmPayment?: typeof confirmUsdcPayment;
  unlockResource?: typeof postUnlock;
};

export function validateAgentPurchaseBinding(params: {
  result: AgentRuntimeResultView;
  policy: AgentBudgetPolicy;
  walletAddress: Address | null;
  accessIntent: PaymentIntent | null;
}): AgentPurchaseFailure | null {
  const { result, policy, walletAddress, accessIntent } = params;

  if (result.decision !== "BUY") {
    return fail(
      "RECOMMENDATION_INVALID",
      "The current recommendation is not eligible for purchase.",
    );
  }

  if (!result.selectedResource || !result.selectedEvaluation) {
    return fail(
      "RECOMMENDATION_INVALID",
      "The selected resource is missing from the agent result.",
    );
  }

  if (!result.selectedEvaluation.budgetEligible) {
    return fail(
      "RECOMMENDATION_INVALID",
      "The selected resource is not budget eligible.",
    );
  }

  if (result.selectedEvaluation.matchScore < policy.minimumMatchScore) {
    return fail(
      "RECOMMENDATION_INVALID",
      "The selected resource no longer meets the match threshold.",
    );
  }

  if (!walletAddress) {
    return fail(
      "AUTHENTICATION_FAILED",
      "Connect your Circle Smart Account before approving this purchase.",
    );
  }

  if (!accessIntent) {
    return fail(
      "NETWORK_ERROR",
      "The live purchase requirement could not be loaded.",
    );
  }

  if (accessIntent.payerWallet.toLowerCase() !== walletAddress.toLowerCase()) {
    return fail(
      "AUTHENTICATION_FAILED",
      "The loaded payment requirement does not match the connected account.",
    );
  }

  if (accessIntent.resource.id !== result.selectedResource.id) {
    return fail(
      "PRICE_CHANGED",
      "The recommended resource no longer matches the live marketplace requirement.",
    );
  }

  if (!approximatelyEqual(accessIntent.amountUSDC, result.selectedResource.priceUSDC)) {
    return fail(
      "PRICE_CHANGED",
      "The resource price changed. Please rerun the agent before purchasing.",
    );
  }

  if (accessIntent.amountUSDC > policy.maxPurchaseUSDC) {
    return fail(
      "RECOMMENDATION_INVALID",
      "The live price exceeds the maximum single purchase policy.",
    );
  }

  if (accessIntent.amountUSDC > policy.remainingBudgetUSDC) {
    return fail(
      "RECOMMENDATION_INVALID",
      "The live price exceeds the remaining budget.",
    );
  }

  return null;
}

export async function executeAgentPurchaseFlow(
  params: AgentPurchaseFlowInput,
): Promise<AgentPurchaseResult> {
  const validation = validateAgentPurchaseBinding({
    result: params.result,
    policy: params.policy,
    walletAddress: params.walletAddress,
    accessIntent: params.accessIntent,
  });

  if (validation) {
    return validation;
  }

  const result = params.result;
  const selectedResource = result.selectedResource as NonNullable<
    AgentRuntimeResultView["selectedResource"]
  >;
  const accessIntent = params.accessIntent as PaymentIntent;
  const bundlerClient = params.bundlerClient;
  let paymentSubmitted = false;
  let paymentPrepared = false;
  let currentStage: AgentPurchaseStage = "REVIEWING";

  if (!bundlerClient || !bundlerClient.account) {
    return fail(
      "AUTHENTICATION_FAILED",
      "Active wallet session is not available for payment.",
    );
  }

  try {
    currentStage = "PREPARING_PAYMENT";
    params.onStage?.({
      phase: "PREPARING_PAYMENT",
      message: "Preparing payment transfers.",
    });

    if (params.executionId) {
      paymentPrepared = true;
      await (params.preparePayment ?? postAgentExecutionPreparePayment)(params.executionId);
    }

    currentStage = "SUBMITTING_PAYMENT";
    params.onStage?.({
      phase: "SUBMITTING_PAYMENT",
      message: "Submitting the Arc payment.",
    });

    const userOpHash = await (params.submitPayment ?? submitUsdcPayment)({
      bundlerClient,
      transfers: [
        {
          recipientWallet: accessIntent.creatorWallet as Address,
          amountUSDC: accessIntent.creatorAmountUSDC,
        },
        {
          recipientWallet: accessIntent.treasuryWallet as Address,
          amountUSDC: accessIntent.treasuryAmountUSDC,
        },
      ],
    });
    paymentSubmitted = true;

    if (params.executionId) {
      await postAgentExecutionPaymentSubmitted(params.executionId, {
        transactionId: userOpHash,
        amountUSDC: accessIntent.amountUSDC,
        resourceId: selectedResource.id,
        resourceTitle: selectedResource.title,
      });
    }

    currentStage = "VERIFYING_SETTLEMENT";
    params.onStage?.({
      phase: "VERIFYING_SETTLEMENT",
      message: "Waiting for settlement confirmation.",
    });

    if (params.executionId) {
      await postAgentExecutionSettlementVerification(params.executionId);
    }

    const confirmation = await (params.confirmPayment ?? confirmUsdcPayment)({
      bundlerClient,
      userOpHash,
    });

    currentStage = "UNLOCKING_RESOURCE";
    params.onStage?.({
      phase: "UNLOCKING_RESOURCE",
      message: "Confirming the resource unlock.",
    });

    const unlockResponse = await (params.unlockResource ?? postUnlock)(
      {
        accessId: accessIntent.accessId,
        txHash: confirmation.transactionHash,
        executionId: params.executionId ?? null,
      },
      { wallet: params.walletAddress ?? undefined },
    );

    if (!unlockResponse.ok) {
      const verificationStatus = unlockResponse.verification.status;
      return fail(
        verificationStatus === "FAILED"
          ? "SETTLEMENT_VERIFICATION_FAILED"
          : "NETWORK_ERROR",
        verificationStatus === "FAILED"
          ? "Settlement verification failed. The purchase was not completed."
          : unlockResponse.verification.reason ??
              "Settlement is still confirming. Retry once the network settles.",
      );
    }

    const completion = buildAgentPurchaseCompletion({
      resourceId: selectedResource.id,
      resourceTitle: selectedResource.title,
      amountUSDC: selectedResource.priceUSDC,
      txHash: unlockResponse.txHash,
      settlementStatus: unlockResponse.verification.status,
      unlocked: unlockResponse.ok,
    });

    params.onStage?.({
      phase: "COMPLETED",
      message: "Purchase complete.",
    });

    return {
      ok: true,
      phase: "COMPLETED",
      completion,
      unlock: unlockResponse,
    };
  } catch (error) {
    if (params.executionId) {
      const failure = classifyPurchaseError(error);

      if (!paymentSubmitted && failure === "APPROVAL_REJECTED") {
        await postAgentExecutionCancelApproval(params.executionId).catch(() => {});
      } else {
        if (paymentPrepared && !paymentSubmitted) {
          await (params.cancelPaymentPreparation ?? postAgentExecutionCancelPaymentPreparation)(
            params.executionId,
          ).catch(() => {});
        }

        if (paymentSubmitted || failure !== "APPROVAL_REJECTED") {
          await postAgentExecutionFailure(params.executionId, {
            code: failure,
            message: getPurchaseErrorMessage(error),
            stage: currentStage,
          }).catch(() => {});
        }
      }
    }

    return fail(
      classifyPurchaseError(error),
      getPurchaseErrorMessage(error),
    );
  }
}

export function buildAgentPurchaseCompletion(params: {
  resourceId: string;
  resourceTitle: string;
  amountUSDC: number;
  txHash: Hash | string;
  settlementStatus: Extract<
    AgentPurchaseCompletionView["settlementStatus"],
    "SETTLED" | "CONFIRMING" | "FAILED"
  >;
  unlocked: boolean;
}): AgentPurchaseCompletionView {
  return {
    resourceId: params.resourceId,
    resourceTitle: params.resourceTitle,
    amountUSDC: params.amountUSDC,
    txHash: params.txHash.toString(),
    settlementStatus: params.settlementStatus,
    unlocked: params.unlocked,
    explorerUrl: params.unlocked ? arcExplorerTxUrl(params.txHash.toString()) : null,
  };
}

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) < 1e-9;
}

function fail(
  reason: AgentPurchaseFailureReason,
  message: string,
): AgentPurchaseFailure {
  return {
    ok: false,
    phase: "FAILED",
    reason,
    message,
  };
}

function classifyPurchaseError(error: unknown): AgentPurchaseFailureReason {
  const message = getErrorMessage(error).toLowerCase();

  if (/rejected|denied|cancelled|canceled/.test(message)) {
    return "APPROVAL_REJECTED";
  }

  if (/insufficient balance|insufficient funds|insufficient/i.test(message)) {
    return "INSUFFICIENT_BALANCE";
  }

  if (/too many pending|duplicate|already submitted/.test(message)) {
    return "DUPLICATE_SUBMISSION";
  }

  if (/not available|session|wallet.*missing|account.*missing/.test(message)) {
    return "AUTHENTICATION_FAILED";
  }

  if (/timed out|timeout|network/i.test(message)) {
    return "NETWORK_ERROR";
  }

  if (/settlement|confirmation/.test(message)) {
    return "SETTLEMENT_VERIFICATION_FAILED";
  }

  return "UNKNOWN";
}

function getPurchaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The purchase could not be completed.";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
