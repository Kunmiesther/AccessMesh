import type { AgentExecutionStatus } from "./AgentExecutionTypes";

export const AGENT_EXECUTION_HISTORY_MAX_LIMIT = 20;
export const AGENT_EXECUTION_HISTORY_DEFAULT_LIMIT = 10;

export type AgentExecutionHistoryDecisionFilter = "all" | "BUY" | "SKIP";

export type AgentExecutionHistoryStatusFilter =
  | "all"
  | "running"
  | "buy-recommended"
  | "skipped"
  | "awaiting-approval"
  | "payment-submitted"
  | "verifying-settlement"
  | "unlocking"
  | "completed"
  | "failed";

export type AgentExecutionHistoryCursor = Readonly<{
  startedAt: string;
  id: string;
}>;

export type AgentExecutionHistoryQuery = Readonly<{
  limit: number;
  cursor: AgentExecutionHistoryCursor | null;
  status: AgentExecutionHistoryStatusFilter;
  decision: AgentExecutionHistoryDecisionFilter;
}>;

export type AgentExecutionHistoryFilterInput = Readonly<{
  cursor?: string | null;
  limit?: string | null;
  status?: string | null;
  decision?: string | null;
}>;

export type AgentExecutionHistoryParseResult =
  | {
      ok: true;
      query: AgentExecutionHistoryQuery;
    }
  | {
      ok: false;
      error: string;
    };

const STATUS_TO_EXECUTION_STATUSES: Record<
  Exclude<AgentExecutionHistoryStatusFilter, "all">,
  readonly AgentExecutionStatus[]
> = {
  running: ["CREATED", "RUNNING"],
  "buy-recommended": ["RECOMMENDED_BUY"],
  skipped: ["RECOMMENDED_SKIP"],
  "awaiting-approval": ["AWAITING_APPROVAL"],
  "payment-submitted": ["PAYMENT_SUBMITTED"],
  "verifying-settlement": ["VERIFYING_SETTLEMENT"],
  unlocking: ["UNLOCKING"],
  completed: ["COMPLETED"],
  failed: ["FAILED"],
};

export function parseAgentExecutionHistoryQuery(
  input: AgentExecutionHistoryFilterInput,
): AgentExecutionHistoryParseResult {
  const limit = parseLimit(input.limit);
  if (limit === null) {
    return {
      ok: false,
      error: "limit must be a positive integer",
    };
  }

  const status = parseStatus(input.status);
  if (status === null) {
    return {
      ok: false,
      error: "status is invalid",
    };
  }

  const decision = parseDecision(input.decision);
  if (decision === null) {
    return {
      ok: false,
      error: "decision is invalid",
    };
  }

  const cursor = parseCursor(input.cursor);
  if (cursor === false) {
    return {
      ok: false,
      error: "cursor is invalid",
    };
  }

  return {
    ok: true,
    query: {
      limit,
      cursor,
      status,
      decision,
    },
  };
}

export function expandAgentExecutionHistoryStatusFilter(
  filter: AgentExecutionHistoryStatusFilter,
): readonly AgentExecutionStatus[] {
  if (filter === "all") {
    return [];
  }

  return STATUS_TO_EXECUTION_STATUSES[filter];
}

export function encodeAgentExecutionHistoryCursor(cursor: AgentExecutionHistoryCursor) {
  return base64UrlEncode(JSON.stringify(cursor));
}

export function decodeAgentExecutionHistoryCursor(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.startedAt !== "string" || typeof record.id !== "string") {
      return null;
    }

    const startedAt = new Date(record.startedAt);
    if (!Number.isFinite(startedAt.getTime())) {
      return null;
    }

    const id = record.id.trim();
    if (!id) {
      return null;
    }

    return {
      startedAt: startedAt.toISOString(),
      id,
    } satisfies AgentExecutionHistoryCursor;
  } catch {
    return null;
  }
}

function parseLimit(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return AGENT_EXECUTION_HISTORY_DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, AGENT_EXECUTION_HISTORY_MAX_LIMIT);
}

function parseStatus(value: string | null | undefined) {
  if (value === null || value === undefined || value === "" || value === "all") {
    return "all";
  }

  if (
    value === "running" ||
    value === "buy-recommended" ||
    value === "skipped" ||
    value === "awaiting-approval" ||
    value === "payment-submitted" ||
    value === "verifying-settlement" ||
    value === "unlocking" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }

  return null;
}

function parseDecision(value: string | null | undefined) {
  if (value === null || value === undefined || value === "" || value === "all") {
    return "all";
  }

  if (value === "BUY" || value === "SKIP") {
    return value;
  }

  return null;
}

function parseCursor(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const decoded = decodeAgentExecutionHistoryCursor(value);
  if (!decoded) {
    return false;
  }

  return decoded;
}

function base64UrlEncode(input: string | Uint8Array) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded.padEnd(Math.ceil(padded.length / 4) * 4, "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}
