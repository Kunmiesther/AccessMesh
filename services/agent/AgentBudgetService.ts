import { InputError } from "@/lib/validation";
import { AgentExecutionRepository } from "./AgentExecutionRepository";
import { AgentApprovalRepository } from "./AgentApprovalRepository";
import {
  AgentBudgetConflictError,
  AgentBudgetRepository,
} from "./AgentBudgetRepository";
import type {
  AgentBudgetActivityPage,
  AgentBudgetBucketView,
  AgentBudgetCommitResult,
  AgentBudgetReleaseResult,
  AgentBudgetReserveResult,
  AgentBudgetSummaryView,
} from "./AgentBudgetTypes";
import { parseUsdcToMicros } from "./AgentBudgetValidation";
import type { AgentExecutionRecord } from "./AgentExecutionTypes";

const DEFAULT_RESERVATION_EXPIRATION_MS = 15 * 60 * 1000;

export class AgentBudgetService {
  constructor(
    private readonly budgetRepository = new AgentBudgetRepository(),
    private readonly executionRepository = new AgentExecutionRepository(),
    private readonly approvalRepository = new AgentApprovalRepository(),
  ) {}

  async getBudgetSummaryForOwner(ownerId: string): Promise<AgentBudgetSummaryView> {
    return this.budgetRepository.getBudgetSummaryForOwner(ownerId);
  }

  async getBudgetForPolicy(ownerId: string, policyId: string): Promise<AgentBudgetBucketView> {
    return this.budgetRepository.getCurrentBudgetForPolicy(ownerId, policyId);
  }

  async listBudgetActivityForOwner(ownerId: string, limit?: number, cursor?: { createdAt: string; id: string } | null): Promise<AgentBudgetActivityPage> {
    return this.budgetRepository.listBudgetActivityForOwner({
      ownerId,
      limit,
      cursor,
    });
  }

  async getReservationForExecution(ownerId: string, executionId: string) {
    return this.budgetRepository.getReservationForExecution(ownerId, executionId);
  }

  async preparePaymentForExecution(ownerId: string, executionId: string): Promise<AgentBudgetReserveResult> {
    const approval = await this.approvalRepository.getApprovalForExecution(ownerId, executionId);
    if (!approval) {
      throw new AgentBudgetConflictError("approval is required before budget reservation");
    }

    if (approval.approvalStatus !== "APPROVED") {
      throw new AgentBudgetConflictError("approval must be approved before budget reservation");
    }

    const execution = await this.requireExecutionForOwner(ownerId, executionId);
    const policyId = getExecutionPolicyId(execution);
    if (!policyId) {
      throw new AgentBudgetConflictError("execution policy snapshot is missing");
    }

    const selectedResource = getSelectedResource(execution);
    if (execution.decision !== "BUY" || !selectedResource) {
      throw new AgentBudgetConflictError("execution is not eligible for payment preparation");
    }

    const amountSource =
      getExecutionPurchaseAmount(execution) ??
      execution.estimatedCostUSDC ??
      selectedResource.priceUSDC;
    const amountMicros = parseAmountMicros(amountSource);

    return this.budgetRepository.reserveBudgetForExecution({
      ownerId,
      policyId,
      executionId,
      amountUSDC: amountMicros,
      expiresAt: new Date(Date.now() + DEFAULT_RESERVATION_EXPIRATION_MS),
    });
  }

  async cancelPaymentPreparation(ownerId: string, executionId: string): Promise<AgentBudgetReleaseResult | null> {
    const execution = await this.requireExecutionForOwner(ownerId, executionId);
    const policyId = getExecutionPolicyId(execution);
    if (!policyId) {
      return null;
    }

    const reservation = await this.budgetRepository.getReservationForExecution(ownerId, executionId);
    if (!reservation) {
      return null;
    }

    try {
      return await this.budgetRepository.releaseReservation({
        ownerId,
        policyId,
        executionId,
        reason: "CANCELLED_BEFORE_PAYMENT",
        amountUSDC: reservation.amountUSDC,
      });
    } catch (error) {
      if (error instanceof AgentBudgetConflictError) {
        return null;
      }

      throw error;
    }
  }

  async finalizePaymentSubmission(ownerId: string, executionId: string, input: {
    transactionId: string;
    amountUSDC: number;
    resourceId: string;
    resourceTitle: string;
  }): Promise<AgentBudgetCommitResult> {
    const execution = await this.requireExecutionForOwner(ownerId, executionId);
    const policyId = getExecutionPolicyId(execution);
    if (!policyId) {
      throw new AgentBudgetConflictError("execution policy snapshot is missing");
    }

    const reservation = await this.budgetRepository.getReservationForExecution(ownerId, executionId);
    if (!reservation) {
      throw new AgentBudgetConflictError("budget reservation is required before payment submission");
    }

    const commitResult = await this.budgetRepository.commitReservation({
      ownerId,
      policyId,
      executionId,
      transactionId: input.transactionId,
      amountUSDC: input.amountUSDC,
      resourceId: input.resourceId,
    });

    return commitResult;
  }

  async reconcileBudgetReservationForExecution(ownerId: string, executionId: string) {
    const execution = await this.requireExecutionForOwner(ownerId, executionId);
    const policyId = getExecutionPolicyId(execution);
    if (!policyId) {
      return null;
    }

    const reservation = await this.budgetRepository.getReservationForExecution(ownerId, executionId);
    if (!reservation) {
      return null;
    }

    if (execution.status === "PAYMENT_SUBMITTED" || execution.status === "VERIFYING_SETTLEMENT" || execution.status === "UNLOCKING" || execution.status === "COMPLETED") {
      return this.budgetRepository.commitReservation({
        ownerId,
        policyId,
        executionId,
        transactionId: execution.txHash ?? execution.id,
        amountUSDC: reservation.amountUSDC,
        resourceId: execution.selectedResourceId ?? null,
      });
    }

    if (execution.status === "FAILED") {
      return this.budgetRepository.releaseReservation({
        ownerId,
        policyId,
        executionId,
        reason: "EXECUTION_INVALIDATED",
        amountUSDC: reservation.amountUSDC,
      });
    }

    return null;
  }

  private async requireExecutionForOwner(ownerId: string, executionId: string): Promise<AgentExecutionRecord> {
    const execution = await this.executionRepository.getExecutionForOwner(ownerId, executionId);
    if (!execution) {
      throw new InputError("execution not found");
    }

    return execution;
  }
}

function parseAmountMicros(value: unknown) {
  const parsed = parseUsdcToMicros(value, "amountUSDC");
  if (!parsed.ok) {
    throw new InputError(parsed.errors.amountUSDC ?? "amountUSDC must be valid");
  }

  return parsed.value.micros;
}

function getExecutionPolicyId(execution: AgentExecutionRecord) {
  const reasoning = execution.reasoning;
  const policy = reasoning && typeof reasoning === "object" ? (reasoning as Record<string, unknown>).policy : null;
  if (!policy || typeof policy !== "object") {
    return null;
  }

  const policyId = (policy as Record<string, unknown>).policyId;
  return typeof policyId === "string" && policyId.trim().length > 0 ? policyId : null;
}

function getSelectedResource(execution: AgentExecutionRecord) {
  const reasoning = execution.reasoning;
  const resource = reasoning && typeof reasoning === "object" ? (reasoning as Record<string, unknown>).selectedResource : null;
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const record = resource as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : "",
    title: typeof record.title === "string" ? record.title : "",
    priceUSDC: typeof record.priceUSDC === "number" ? record.priceUSDC : 0,
  };
}

function getExecutionPurchaseAmount(execution: AgentExecutionRecord) {
  const reasoning = execution.reasoning;
  const purchase = reasoning && typeof reasoning === "object" ? (reasoning as Record<string, unknown>).purchase : null;
  if (!purchase || typeof purchase !== "object") {
    return null;
  }

  const amountUSDC = (purchase as Record<string, unknown>).amountUSDC;
  return typeof amountUSDC === "number" ? amountUSDC : null;
}
