import type {
  AgentBudgetActivityPage,
  AgentBudgetBucketView,
  AgentBudgetCommitResult,
  AgentBudgetLedgerEntryView,
  AgentBudgetReleaseResult,
  AgentBudgetReserveResult,
  AgentBudgetReservationView,
  AgentBudgetSummaryView,
  AgentBudgetPeriodType,
} from "./AgentBudgetTypes";
import { formatMicrosToUsdcString } from "./AgentBudgetValidation";

type BucketRow = Readonly<{
  id: string;
  ownerId: string;
  policyId: string;
  periodType: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  limitMicros: bigint | number | string;
  committedMicros: bigint | number | string;
  reservedMicros: bigint | number | string;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  policy: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  reservations?: Array<{ id: string; status: string }>;
}>;

type ReservationRow = Readonly<{
  id: string;
  bucketId: string;
  executionId: string;
  amountMicros: bigint | number | string;
  status: string;
  expiresAt: Date | string | null;
  committedAt: Date | string | null;
  releasedAt: Date | string | null;
  releaseReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  bucket: BucketRow;
}>;

type LedgerRow = Readonly<{
  id: string;
  bucketId: string;
  executionId: string | null;
  reservationId: string | null;
  type: string;
  amountMicros: bigint | number | string;
  dedupeKey: string;
  metadata: unknown;
  createdAt: Date | string;
  bucket: BucketRow;
}>;

export function toAgentBudgetBucketView(row: BucketRow): AgentBudgetBucketView {
  const limitMicros = toBigInt(row.limitMicros);
  const committedMicros = toBigInt(row.committedMicros);
  const reservedMicros = toBigInt(row.reservedMicros);
  const availableMicros = limitMicros - committedMicros - reservedMicros;

  return {
    bucketId: row.id,
    ownerId: row.ownerId,
    policyId: row.policyId,
    policyName: row.policy.name,
    policyVersion: row.policy.version,
    status: row.policy.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    periodType: normalizePeriodType(row.periodType),
    periodStart: toIsoString(row.periodStart),
    periodEnd: toIsoString(row.periodEnd),
    limitUSDC: formatMicrosToUsdcString(limitMicros),
    committedUSDC: formatMicrosToUsdcString(committedMicros),
    reservedUSDC: formatMicrosToUsdcString(reservedMicros),
    availableUSDC: formatMicrosToUsdcString(availableMicros > BigInt(0) ? availableMicros : BigInt(0)),
    activeReservationCount: Array.isArray(row.reservations)
      ? row.reservations.filter((reservation) => reservation.status === "ACTIVE" || reservation.status === "SUBMISSION_UNKNOWN").length
      : 0,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toAgentBudgetReservationView(row: ReservationRow): AgentBudgetReservationView {
  return {
    id: row.id,
    bucketId: row.bucketId,
    executionId: row.executionId,
    policyId: row.bucket.policyId,
    policyName: row.bucket.policy.name,
    policyVersion: row.bucket.policy.version,
    periodType: normalizePeriodType(row.bucket.periodType),
    periodStart: toIsoString(row.bucket.periodStart),
    periodEnd: toIsoString(row.bucket.periodEnd),
    amountUSDC: formatMicrosToUsdcString(toBigInt(row.amountMicros)),
    status: normalizeReservationStatus(row.status),
    expiresAt: toOptionalIsoString(row.expiresAt),
    committedAt: toOptionalIsoString(row.committedAt),
    releasedAt: toOptionalIsoString(row.releasedAt),
    releaseReason: normalizeReleaseReason(row.releaseReason),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function toAgentBudgetLedgerEntryView(row: LedgerRow): AgentBudgetLedgerEntryView {
  return {
    id: row.id,
    bucketId: row.bucketId,
    executionId: row.executionId,
    reservationId: row.reservationId,
    type: normalizeEntryType(row.type),
    amountUSDC: formatMicrosToUsdcString(toBigInt(row.amountMicros)),
    dedupeKey: row.dedupeKey,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: toIsoString(row.createdAt),
    policyId: row.bucket.policyId,
    policyName: row.bucket.policy.name,
    policyVersion: row.bucket.policy.version,
    periodType: normalizePeriodType(row.bucket.periodType),
    periodStart: toIsoString(row.bucket.periodStart),
    periodEnd: toIsoString(row.bucket.periodEnd),
  };
}

export function toAgentBudgetReserveResult(input: {
  bucket: BucketRow;
  reservation: ReservationRow;
  activity?: LedgerRow | null;
}): AgentBudgetReserveResult {
  return {
    bucket: toAgentBudgetBucketView(input.bucket),
    reservation: toAgentBudgetReservationView(input.reservation),
    activity: input.activity ? toAgentBudgetLedgerEntryView(input.activity) : null,
  };
}

export function toAgentBudgetCommitResult(input: {
  bucket: BucketRow;
  reservation: ReservationRow;
  activity?: LedgerRow | null;
}): AgentBudgetCommitResult {
  return {
    bucket: toAgentBudgetBucketView(input.bucket),
    reservation: toAgentBudgetReservationView(input.reservation),
    activity: input.activity ? toAgentBudgetLedgerEntryView(input.activity) : null,
  };
}

export function toAgentBudgetReleaseResult(input: {
  bucket: BucketRow;
  reservation: ReservationRow;
  activity?: LedgerRow | null;
}): AgentBudgetReleaseResult {
  return {
    bucket: toAgentBudgetBucketView(input.bucket),
    reservation: toAgentBudgetReservationView(input.reservation),
    activity: input.activity ? toAgentBudgetLedgerEntryView(input.activity) : null,
  };
}

export function toAgentBudgetSummaryView(input: {
  policies: BucketRow[];
}): AgentBudgetSummaryView {
  const views = input.policies.map((row) => toAgentBudgetBucketView(row));
  const totals = views.reduce(
    (acc, bucket) => {
      acc.committedUSDC = addUsdcStrings(acc.committedUSDC, bucket.committedUSDC);
      acc.reservedUSDC = addUsdcStrings(acc.reservedUSDC, bucket.reservedUSDC);
      acc.availableUSDC = addUsdcStrings(acc.availableUSDC, bucket.availableUSDC);
      acc.activeReservations += bucket.activeReservationCount;
      return acc;
    },
    {
      committedUSDC: "0",
      reservedUSDC: "0",
      availableUSDC: "0",
      activeReservations: 0,
    },
  );

  return {
    policies: views,
    totals,
  };
}

export type AgentBudgetActivityPageBuilder = AgentBudgetActivityPage;

function normalizePeriodType(value: string): AgentBudgetPeriodType {
  return value === "MONTHLY" ? "MONTHLY" : "DAILY";
}

function normalizeReservationStatus(value: string) {
  if (
    value === "ACTIVE" ||
    value === "SUBMISSION_UNKNOWN" ||
    value === "COMMITTED" ||
    value === "RELEASED" ||
    value === "EXPIRED"
  ) {
    return value;
  }

  return "ACTIVE";
}

function normalizeReleaseReason(value: string | null) {
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

function normalizeEntryType(value: string) {
  if (value === "RESERVATION" || value === "COMMITMENT" || value === "RELEASE" || value === "ADJUSTMENT") {
    return value;
  }

  return "ADJUSTMENT";
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toOptionalIsoString(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return toIsoString(value);
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function toBigInt(value: bigint | number | string) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return BigInt(value);
  }

  return BigInt(0);
}

function addUsdcStrings(left: string, right: string) {
  const leftMicros = parseUsdcString(left);
  const rightMicros = parseUsdcString(right);
  return formatMicrosToUsdcString(leftMicros + rightMicros);
}

function parseUsdcString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return BigInt(0);
  }

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const micros =
    BigInt(wholePart || "0") * BigInt(1_000_000) +
    BigInt((fractionPart + "000000").slice(0, 6));
  return negative ? -micros : micros;
}
