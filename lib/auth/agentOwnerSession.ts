import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress } from "viem";

export type AgentOwnerAuthenticationMethod =
  | "CIRCLE_SESSION"
  | "SIGNED_CHALLENGE";

export type AuthenticatedOwner = Readonly<{
  ownerId: string;
  walletAddress: string;
  username: string;
  authenticationMethod: AgentOwnerAuthenticationMethod;
}>;

export type AgentOwnerSessionPayload = Readonly<{
  ownerId: string;
  walletAddress: string;
  username: string;
  authenticationMethod: AgentOwnerAuthenticationMethod;
  issuedAt: string;
  expiresAt: string;
}>;

const SESSION_COOKIE_NAME = "accessmesh_agent_owner_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEVELOPMENT_SECRET = "accessmesh-agent-owner-session-dev-secret";

export function getAgentOwnerSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getAgentOwnerSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export function normalizeSessionWalletAddress(value: string) {
  return getAddress(value);
}

export function createAgentOwnerSessionPayload(owner: AuthenticatedOwner): AgentOwnerSessionPayload {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  return {
    ownerId: owner.ownerId,
    walletAddress: normalizeSessionWalletAddress(owner.walletAddress),
    username: owner.username.trim(),
    authenticationMethod: owner.authenticationMethod,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function encodeAgentOwnerSession(payload: AgentOwnerSessionPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signSessionBody(body);

  return `v1.${body}.${signature}`;
}

export function setAgentOwnerSessionCookie(
  response: NextResponse,
  payload: AgentOwnerSessionPayload,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeAgentOwnerSession(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAgentOwnerSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function decodeAgentOwnerSession(cookieValue: string | null | undefined) {
  if (!cookieValue) {
    return null;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return null;
  }

  const [_, body, signature] = parts;
  const expectedSignature = signSessionBody(body);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  const parsed = safeParseJson(base64UrlDecode(body));
  if (!isAgentOwnerSessionPayload(parsed)) {
    return null;
  }

  const expiresAt = new Date(parsed.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    ownerId: parsed.ownerId,
    walletAddress: normalizeSessionWalletAddress(parsed.walletAddress),
    username: parsed.username.trim(),
    authenticationMethod: parsed.authenticationMethod,
  } satisfies AuthenticatedOwner;
}

function signSessionBody(body: string) {
  return base64UrlEncode(
    createHmac("sha256", getSessionSecret()).update(body).digest(),
  );
}

function getSessionSecret() {
  const secret =
    process.env.AGENT_OWNER_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (secret && secret.trim().length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_SECRET;
  }

  throw new Error("Agent owner session secret is not configured.");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isAgentOwnerSessionPayload(value: unknown): value is AgentOwnerSessionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.ownerId === "string" &&
    typeof record.walletAddress === "string" &&
    typeof record.username === "string" &&
    (record.authenticationMethod === "CIRCLE_SESSION" ||
      record.authenticationMethod === "SIGNED_CHALLENGE") &&
    typeof record.issuedAt === "string" &&
    typeof record.expiresAt === "string"
  );
}
