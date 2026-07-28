import type {
  AgentPolicyDetail,
  AgentPolicyInput,
  AgentPolicyRunOverrides,
  AgentPolicyStatus,
  AgentPolicySummary,
  AgentPolicyUpdateInput,
} from "./AgentPolicyTypes";

export type AgentPolicyValidationErrors = Partial<Record<string, string>> & {
  root?: string;
};

export type AgentPolicyValidationResult<T> =
  | {
      ok: true;
      value: T;
      errors: AgentPolicyValidationErrors;
    }
  | {
      ok: false;
      value: null;
      errors: AgentPolicyValidationErrors;
    };

export type NormalizedAgentPolicyCreateInput = {
  name: string;
  description: string | null;
  dailyBudgetUSDC: number;
  remainingBudgetUSDC: number;
  maxPurchaseUSDC: number;
  minimumScore: number;
  expiresAt: string | null;
  manualApprovalRequired: true;
};

export type NormalizedAgentPolicyUpdateInput = {
  expectedVersion: number;
  name?: string;
  description?: string | null;
  dailyBudgetUSDC?: number;
  remainingBudgetUSDC?: number;
  maxPurchaseUSDC?: number;
  minimumScore?: number;
  expiresAt?: string | null;
  manualApprovalRequired?: true;
};

export type NormalizedAgentPolicyRunOverrides = {
  remainingBudgetUSDC?: number;
  maxPurchaseUSDC?: number;
  minimumScore?: number;
};

const CREATE_ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "dailyBudgetUSDC",
  "remainingBudgetUSDC",
  "maxPurchaseUSDC",
  "minimumScore",
  "expiresAt",
  "manualApprovalRequired",
]);

const UPDATE_ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "dailyBudgetUSDC",
  "remainingBudgetUSDC",
  "maxPurchaseUSDC",
  "minimumScore",
  "expiresAt",
  "manualApprovalRequired",
  "expectedVersion",
]);

const OVERRIDE_ALLOWED_FIELDS = new Set([
  "remainingBudgetUSDC",
  "maxPurchaseUSDC",
  "minimumScore",
]);

export function validateAgentPolicyCreateInput(
  input: unknown,
): AgentPolicyValidationResult<NormalizedAgentPolicyCreateInput> {
  if (!isRecord(input) || Array.isArray(input)) {
    return invalid({ root: "policy input must be an object" });
  }

  const errors: AgentPolicyValidationErrors = {};
  reportUnknownFields(input, CREATE_ALLOWED_FIELDS, errors);

  const name = normalizeName(input.name, errors, "name");
  const description = normalizeOptionalText(input.description, 280, errors, "description");
  const manualApprovalRequired = validateManualApproval(input.manualApprovalRequired, errors);
  const dailyBudgetUSDC = parseUsdc(input.dailyBudgetUSDC, errors, "dailyBudgetUSDC");
  const remainingBudgetUSDC = parseUsdc(input.remainingBudgetUSDC, errors, "remainingBudgetUSDC");
  const maxPurchaseUSDC = parseUsdc(input.maxPurchaseUSDC, errors, "maxPurchaseUSDC");
  const minimumScore = parseScore(input.minimumScore, errors, "minimumScore");
  const expiresAt = normalizeExpiration(input.expiresAt, errors, "expiresAt");

  if (
    typeof dailyBudgetUSDC === "number" &&
    typeof remainingBudgetUSDC === "number" &&
    remainingBudgetUSDC > dailyBudgetUSDC
  ) {
    errors.remainingBudgetUSDC = "remaining budget cannot exceed daily budget";
  }

  if (
    typeof dailyBudgetUSDC === "number" &&
    typeof maxPurchaseUSDC === "number" &&
    maxPurchaseUSDC > dailyBudgetUSDC
  ) {
    errors.maxPurchaseUSDC = "maximum purchase cannot exceed daily budget";
  }

  if (errors.root || Object.keys(errors).length > 0) {
    return invalid(errors);
  }

  const normalized: NormalizedAgentPolicyCreateInput = {
    name: name as string,
    description: description ?? null,
    dailyBudgetUSDC: dailyBudgetUSDC as number,
    remainingBudgetUSDC: remainingBudgetUSDC as number,
    maxPurchaseUSDC: maxPurchaseUSDC as number,
    minimumScore: minimumScore as number,
    expiresAt: expiresAt ?? null,
    manualApprovalRequired,
  };

  return valid(normalized);
}

export function validateAgentPolicyUpdateInput(
  input: unknown,
  currentPolicy: AgentPolicySummary | AgentPolicyDetail,
): AgentPolicyValidationResult<NormalizedAgentPolicyUpdateInput> {
  if (!isRecord(input) || Array.isArray(input)) {
    return invalid({ root: "policy input must be an object" });
  }

  const errors: AgentPolicyValidationErrors = {};
  reportUnknownFields(input, UPDATE_ALLOWED_FIELDS, errors);

  const expectedVersion = parseExpectedVersion(input.expectedVersion, errors);
  const name = normalizeOptionalName(input.name, errors, "name");
  const description = normalizeOptionalText(input.description, 280, errors, "description", true);
  const manualApprovalRequired = validateManualApproval(input.manualApprovalRequired, errors);
  const dailyBudgetUSDC = parseUsdcOptional(input.dailyBudgetUSDC, errors, "dailyBudgetUSDC");
  const remainingBudgetUSDC = parseUsdcOptional(input.remainingBudgetUSDC, errors, "remainingBudgetUSDC");
  const maxPurchaseUSDC = parseUsdcOptional(input.maxPurchaseUSDC, errors, "maxPurchaseUSDC");
  const minimumScore = parseScoreOptional(input.minimumScore, errors, "minimumScore");
  const expiresAt = normalizeExpiration(input.expiresAt, errors, "expiresAt", true);

  if (
    typeof dailyBudgetUSDC === "number" &&
    typeof remainingBudgetUSDC === "number" &&
    remainingBudgetUSDC > dailyBudgetUSDC
  ) {
    errors.remainingBudgetUSDC = "remaining budget cannot exceed daily budget";
  }

  if (
    typeof dailyBudgetUSDC === "number" &&
    typeof maxPurchaseUSDC === "number" &&
    maxPurchaseUSDC > dailyBudgetUSDC
  ) {
    errors.maxPurchaseUSDC = "maximum purchase cannot exceed daily budget";
  }

  if (
    errors.root ||
    Object.keys(errors).length > 0 ||
    expectedVersion === null
  ) {
    return invalid(errors);
  }

  const normalized: NormalizedAgentPolicyUpdateInput = {
    expectedVersion,
  };

  if (name !== undefined) {
    normalized.name = name;
  }
  if (description !== undefined) {
    normalized.description = description;
  }
  if (typeof dailyBudgetUSDC === "number") {
    normalized.dailyBudgetUSDC = dailyBudgetUSDC;
  }
  if (typeof remainingBudgetUSDC === "number") {
    normalized.remainingBudgetUSDC = remainingBudgetUSDC;
  }
  if (typeof maxPurchaseUSDC === "number") {
    normalized.maxPurchaseUSDC = maxPurchaseUSDC;
  }
  if (typeof minimumScore === "number") {
    normalized.minimumScore = minimumScore;
  }
  if (expiresAt !== undefined) {
    normalized.expiresAt = expiresAt;
  }
  if (manualApprovalRequired) {
    normalized.manualApprovalRequired = true;
  }

  return valid(normalized);
}

export function validateAgentPolicyRunOverrides(
  input: unknown,
  currentPolicy: Pick<
    AgentPolicySummary | AgentPolicyDetail,
    "dailyBudgetUSDC" | "remainingBudgetUSDC" | "maxPurchaseUSDC" | "minimumScore"
  >,
): AgentPolicyValidationResult<NormalizedAgentPolicyRunOverrides> {
  if (input === null || input === undefined || input === "") {
    return valid({});
  }

  if (!isRecord(input) || Array.isArray(input)) {
    return invalid({ root: "policy overrides must be an object" });
  }

  const errors: AgentPolicyValidationErrors = {};
  reportUnknownFields(input, OVERRIDE_ALLOWED_FIELDS, errors);

  const remainingBudgetUSDC = parseUsdcOptional(input.remainingBudgetUSDC, errors, "remainingBudgetUSDC");
  const maxPurchaseUSDC = parseUsdcOptional(input.maxPurchaseUSDC, errors, "maxPurchaseUSDC");
  const minimumScore = parseScoreOptional(input.minimumScore, errors, "minimumScore");

  if (
    typeof remainingBudgetUSDC === "number" &&
    remainingBudgetUSDC > Number(currentPolicy.remainingBudgetUSDC)
  ) {
    errors.remainingBudgetUSDC = "remaining budget overrides can only reduce the saved policy allowance";
  }

  if (
    typeof maxPurchaseUSDC === "number" &&
    maxPurchaseUSDC > Number(currentPolicy.maxPurchaseUSDC)
  ) {
    errors.maxPurchaseUSDC = "maximum purchase overrides can only reduce the saved policy allowance";
  }

  if (
    typeof minimumScore === "number" &&
    minimumScore < Number(currentPolicy.minimumScore)
  ) {
    errors.minimumScore = "minimum score overrides can only be more restrictive";
  }

  if (errors.root || Object.keys(errors).length > 0) {
    return invalid(errors);
  }

  const normalized: NormalizedAgentPolicyRunOverrides = {};
  if (typeof remainingBudgetUSDC === "number") {
    normalized.remainingBudgetUSDC = remainingBudgetUSDC;
  }
  if (typeof maxPurchaseUSDC === "number") {
    normalized.maxPurchaseUSDC = maxPurchaseUSDC;
  }
  if (typeof minimumScore === "number") {
    normalized.minimumScore = minimumScore;
  }

  return valid(normalized);
}

export function validateAgentPolicyUsability(
  policy: Pick<AgentPolicySummary | AgentPolicyDetail, "status" | "manualApprovalRequired" | "expiresAt" | "archivedAt">,
) {
  const errors: AgentPolicyValidationErrors = {};

  if (policy.status !== "ACTIVE") {
    errors.status = "policy must be active";
  }

  if (policy.archivedAt) {
    errors.archivedAt = "archived policies cannot be used for new runs";
  }

  if (policy.manualApprovalRequired !== true) {
    errors.manualApprovalRequired = "manual approval is required";
  }

  if (policy.expiresAt && !isFutureDate(policy.expiresAt)) {
    errors.expiresAt = "policy expiration must be in the future";
  }

  return errors.root || Object.keys(errors).length > 0
    ? invalid(errors)
    : valid(undefined);
}

export function validateAgentPolicyDefaultEligibility(
  policy: Pick<AgentPolicySummary | AgentPolicyDetail, "status" | "manualApprovalRequired" | "expiresAt" | "archivedAt">,
) {
  const result = validateAgentPolicyUsability(policy);
  return result;
}

function valid<T>(value: T): AgentPolicyValidationResult<T> {
  return {
    ok: true,
    value,
    errors: {},
  };
}

function invalid(errors: AgentPolicyValidationErrors): AgentPolicyValidationResult<never> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

function reportUnknownFields(
  input: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  errors: AgentPolicyValidationErrors,
) {
  const unknownFields = Object.keys(input).filter((key) => !allowedFields.has(key));
  if (unknownFields.length > 0) {
    errors.root = `unknown field(s): ${unknownFields.join(", ")}`;
  }
}

function normalizeName(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  if (typeof value !== "string") {
    errors[field] = "name is required";
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    errors[field] = "name is required";
    return null;
  }

  if (normalized.length > 80) {
    errors[field] = "name must be 80 characters or fewer";
    return null;
  }

  return normalized;
}

function normalizeOptionalName(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  if (value === undefined) {
    return undefined;
  }

  return normalizeName(value, errors, field) ?? undefined;
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number,
  errors: AgentPolicyValidationErrors,
  field: string,
  allowUndefined = false,
) {
  if (value === undefined) {
    return allowUndefined ? undefined : null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    errors[field] = `${field} must be a string`;
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    errors[field] = `${field} must be ${maxLength} characters or fewer`;
    return null;
  }

  return normalized;
}

function validateManualApproval(value: unknown, errors: AgentPolicyValidationErrors) {
  if (value === undefined || value === true) {
    return true as const;
  }

  errors.manualApprovalRequired = "manual approval cannot be disabled";
  return true as const;
}

function parseExpectedVersion(value: unknown, errors: AgentPolicyValidationErrors) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    errors.expectedVersion = "expectedVersion must be a positive integer";
    return null;
  }

  return value;
}

function parseUsdc(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  const parsed = parseUsdcOptional(value, errors, field);
  if (parsed === undefined || parsed === null) {
    errors[field] = `${field} is required`;
    return null;
  }

  return parsed;
}

function parseUsdcOptional(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed: number = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    errors[field] = `${field} must be a number greater than or equal to 0`;
    return null;
  }

  if (!/^\d+(?:\.\d{1,6})?$/.test(String(value).trim())) {
    errors[field] = `${field} must use at most 6 decimal places`;
    return null;
  }

  return parsed;
}

function parseScore(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  const parsed = parseScoreOptional(value, errors, field);
  if (parsed === undefined || parsed === null) {
    errors[field] = `${field} is required`;
    return null;
  }

  return parsed;
}

function parseScoreOptional(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed: number = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    errors[field] = `${field} must be an integer from 0 to 100`;
    return null;
  }

  return parsed;
}

function normalizeExpiration(
  value: unknown,
  errors: AgentPolicyValidationErrors,
  field: string,
  allowUndefined = false,
) {
  if (value === undefined) {
    return allowUndefined ? undefined : null;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors[field] = `${field} must be an ISO timestamp`;
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    errors[field] = `${field} must be a valid date`;
    return null;
  }

  if (date.getTime() <= Date.now()) {
    errors[field] = `${field} must be in the future`;
    return null;
  }

  return date.toISOString();
}

function isFutureDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
