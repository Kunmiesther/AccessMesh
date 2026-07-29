import {
  AGENT_APPROVAL_LIST_DEFAULT_LIMIT,
  AGENT_APPROVAL_LIST_MAX_LIMIT,
  type AgentApprovalListFilter,
  type AgentApprovalRejectionReason,
  type AgentApprovalRejectInput,
  type AgentApprovalListQuery,
  type AgentApprovalListQueryParseResult,
  type AgentApprovalListQueryInput,
} from "./AgentApprovalTypes";

export type AgentApprovalRejectValidationResult =
  | {
      ok: true;
      value: AgentApprovalRejectInput;
    }
  | {
      ok: false;
      error: string;
    };

export function parseAgentApprovalListQuery(
  input: AgentApprovalListQueryInput,
): AgentApprovalListQueryParseResult {
  const limit = parseLimit(input.limit);
  if (limit === null) {
    return { ok: false, error: "limit must be a positive integer" };
  }

  const status = parseStatus(input.status);
  if (status === null) {
    return { ok: false, error: "status is invalid" };
  }

  const cursor = parseCursor(input.cursor);
  if (cursor === false) {
    return { ok: false, error: "cursor is invalid" };
  }

  return {
    ok: true,
    query: {
      limit,
      cursor,
      status,
    },
  };
}

export function encodeAgentApprovalCursor(cursor: AgentApprovalListQuery["cursor"]) {
  return base64UrlEncode(JSON.stringify(cursor));
}

export function validateAgentApprovalRejectInput(
  input: unknown,
): AgentApprovalRejectValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "request body must be an object" };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["reasonCode", "reasonText"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `unknown field: ${key}` };
    }
  }

  let reasonCode: AgentApprovalRejectionReason = "NO_LONGER_NEEDED";
  if (record.reasonCode !== undefined && record.reasonCode !== null && record.reasonCode !== "") {
    const parsedReasonCode = String(record.reasonCode).trim() as AgentApprovalRejectionReason;
    if (
      parsedReasonCode !== "TOO_EXPENSIVE" &&
      parsedReasonCode !== "LOW_CONFIDENCE" &&
      parsedReasonCode !== "NOT_RELEVANT" &&
      parsedReasonCode !== "NO_LONGER_NEEDED" &&
      parsedReasonCode !== "OTHER"
    ) {
      return { ok: false, error: "reasonCode is invalid" };
    }

    reasonCode = parsedReasonCode;
  }

  let reasonText: string | null = null;
  if (record.reasonText !== undefined && record.reasonText !== null && record.reasonText !== "") {
    if (typeof record.reasonText !== "string") {
      return { ok: false, error: "reasonText must be a string" };
    }

    const trimmed = record.reasonText.trim();
    if (trimmed.length === 0) {
      reasonText = null;
    } else if (trimmed.length > 240) {
      return { ok: false, error: "reasonText is too long" };
    } else if (/[<>]/.test(trimmed)) {
      return { ok: false, error: "reasonText must be plain text" };
    } else {
      reasonText = trimmed;
    }
  }

  return {
    ok: true,
    value: {
      reasonCode,
      reasonText,
    },
  };
}

function parseLimit(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return AGENT_APPROVAL_LIST_DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, AGENT_APPROVAL_LIST_MAX_LIMIT);
}

function parseStatus(value: string | null | undefined): AgentApprovalListFilter | null {
  if (value === null || value === undefined || value === "" || value === "all") {
    return "all";
  }

  if (value === "pending" || value === "resolved") {
    return value;
  }

  return null;
}

function parseCursor(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(value)) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return false;
    }

    const record = decoded as Record<string, unknown>;
    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return false;
    }

    const createdAt = new Date(record.createdAt);
    if (!Number.isFinite(createdAt.getTime())) {
      return false;
    }

    const id = record.id.trim();
    if (!id) {
      return false;
    }

    return {
      createdAt: createdAt.toISOString(),
      id,
    } satisfies AgentApprovalListQuery["cursor"];
  } catch {
    return false;
  }
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function base64UrlEncode(input: string | Uint8Array) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
