import type {
  AgentBudgetPeriodType,
  AgentBudgetReleaseReason,
  AgentBudgetReservationStatus,
} from "./AgentBudgetTypes";

export type AgentBudgetValidationErrors = Partial<Record<string, string>> & {
  root?: string;
};

export type AgentBudgetValidationResult<T> =
  | {
      ok: true;
      value: T;
      errors: AgentBudgetValidationErrors;
    }
  | {
      ok: false;
      value: null;
      errors: AgentBudgetValidationErrors;
    };

export type ParsedUsdcAmount = Readonly<{
  micros: bigint;
  usdc: string;
}>;

export type BudgetPeriodBounds = Readonly<{
  periodType: AgentBudgetPeriodType;
  periodStart: string;
  periodEnd: string;
}>;

const MAX_USDC_DECIMALS = 6;

export function parseUsdcToMicros(
  value: unknown,
  field = "amountUSDC",
): AgentBudgetValidationResult<ParsedUsdcAmount> {
  const errors: AgentBudgetValidationErrors = {};
  const micros = normalizeUsdcToMicros(value, errors, field);

  if (errors.root || Object.keys(errors).length > 0 || micros === null) {
    return invalid(errors);
  }

  return valid({
    micros,
    usdc: formatMicrosToUsdcString(micros),
  });
}

export function normalizeUsdcToMicros(
  value: unknown,
  errors: AgentBudgetValidationErrors,
  field: string,
  options: { allowZero?: boolean; allowNegative?: boolean } = {},
) {
  if (value === null || value === undefined || value === "") {
    errors[field] = `${field} is required`;
    return null;
  }

  if (typeof value === "bigint") {
    if (value < BigInt(0) && !options.allowNegative) {
      errors[field] = `${field} must be greater than or equal to 0`;
      return null;
    }

    if (value === BigInt(0) && options.allowZero === false) {
      errors[field] = `${field} must be greater than 0`;
      return null;
    }

    return value;
  }

  const normalized =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value.toString()
        : null
      : typeof value === "string"
        ? value.trim()
        : null;

  if (!normalized) {
    errors[field] = `${field} must be a valid USDC amount`;
    return null;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    errors[field] = `${field} must be a valid USDC amount`;
    return null;
  }

  const negative = normalized.startsWith("-");
  if (negative && !options.allowNegative) {
    errors[field] = `${field} must be greater than or equal to 0`;
    return null;
  }

  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  if (fractionPart.length > MAX_USDC_DECIMALS) {
    errors[field] = `${field} cannot have more than ${MAX_USDC_DECIMALS} decimal places`;
    return null;
  }

  const micros =
    BigInt(wholePart || "0") * BigInt(1_000_000) +
    BigInt((fractionPart + "000000").slice(0, MAX_USDC_DECIMALS));

  if (micros === BigInt(0) && options.allowZero === false) {
    errors[field] = `${field} must be greater than 0`;
    return null;
  }

  return negative ? -micros : micros;
}

export function formatMicrosToUsdcString(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const whole = absolute / BigInt(1_000_000);
  const fraction = absolute % BigInt(1_000_000);
  const fractionText = fraction.toString().padStart(MAX_USDC_DECIMALS, "0").replace(/0+$/, "");
  const combined = fractionText.length > 0 ? `${whole.toString()}.${fractionText}` : whole.toString();
  return negative && combined !== "0" ? `-${combined}` : combined;
}

export function resolveBudgetPeriodBounds(
  periodType: AgentBudgetPeriodType,
  now = new Date(),
): BudgetPeriodBounds {
  const cursor = new Date(now);
  if (periodType === "MONTHLY") {
    const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    return {
      periodType,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    periodType,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

export function validateBudgetReservationStatusTransition(params: {
  from: AgentBudgetReservationStatus;
  to: AgentBudgetReservationStatus;
  idempotent?: boolean;
}) {
  const { from, to, idempotent = false } = params;
  if (from === to) {
    if (!idempotent && (from === "COMMITTED" || from === "RELEASED" || from === "EXPIRED")) {
      throw new Error(`Reservation status ${from} is terminal and cannot be updated.`);
    }

    return;
  }

  const allowed: Record<AgentBudgetReservationStatus, readonly AgentBudgetReservationStatus[]> = {
    ACTIVE: ["SUBMISSION_UNKNOWN", "COMMITTED", "RELEASED", "EXPIRED"],
    SUBMISSION_UNKNOWN: ["COMMITTED", "RELEASED", "EXPIRED"],
    COMMITTED: [],
    RELEASED: [],
    EXPIRED: [],
  };

  if (!allowed[from].includes(to)) {
    throw new Error(`Invalid reservation status transition: ${from} -> ${to}`);
  }
}

export function validateBudgetReleaseReason(
  value: unknown,
): AgentBudgetReleaseReason | null {
  if (
    value === "CANCELLED_BEFORE_PAYMENT" ||
    value === "RESERVATION_EXPIRED" ||
    value === "EXECUTION_INVALIDATED" ||
    value === "PAYMENT_NOT_SUBMITTED" ||
    value === "OTHER"
  ) {
    return value;
  }

  return null;
}

export function buildBudgetValidationError(message: string) {
  return invalid({ root: message });
}

function valid<T>(value: T): AgentBudgetValidationResult<T> {
  return {
    ok: true,
    value,
    errors: {},
  };
}

function invalid(errors: AgentBudgetValidationErrors): AgentBudgetValidationResult<never> {
  return {
    ok: false,
    value: null,
    errors,
  };
}
