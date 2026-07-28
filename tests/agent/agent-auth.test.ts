import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { GET as getAgentOwnerSession } from "../../app/api/auth/session/route";
import { POST as logoutAgentOwnerSession } from "../../app/api/auth/logout/route";
import { GET as getAgentExecution } from "../../app/api/agent/executions/[id]/route";
import {
  handleWalletVerifyRequest,
} from "../../app/api/auth/wallet/verify/route";
import {
  createAgentOwnerSessionPayload,
  decodeAgentOwnerSession,
  encodeAgentOwnerSession,
  setAgentOwnerSessionCookie,
} from "../../lib/auth/agentOwnerSession";
import { getOwnedAgentExecution } from "../../lib/auth/requireOwnedAgentExecution";
import { doesAgentOwnerSessionMatchWallet } from "../../hooks/useAgentOwnerSession";

test("session cookie is HTTP-only and decodes safely", () => {
  const payload = createAgentOwnerSessionPayload({
    ownerId: "owner-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    username: "accessmesh",
    authenticationMethod: "CIRCLE_SESSION",
  });

  const nextResponse = NextResponse.json({ ok: true });
  setAgentOwnerSessionCookie(nextResponse, payload);
  const cookie = nextResponse.headers.get("set-cookie") ?? "";

  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.equal(
    decodeAgentOwnerSession(encodeAgentOwnerSession(payload))?.ownerId,
    "owner-1",
  );
  assert.equal(
    doesAgentOwnerSessionMatchWallet(
      {
        ownerId: "owner-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        username: "accessmesh",
        authenticationMethod: "CIRCLE_SESSION",
      },
      "0x1111111111111111111111111111111111111111",
    ),
    true,
  );
  assert.equal(
    doesAgentOwnerSessionMatchWallet(
      {
        ownerId: "owner-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        username: "accessmesh",
        authenticationMethod: "CIRCLE_SESSION",
      },
      "0x2222222222222222222222222222222222222222",
    ),
    false,
  );
});

test("wallet verify creates a session with trusted login verification", async () => {
  const request = new Request("http://localhost/api/auth/wallet/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "accessmesh",
      credential: { id: "credential-1", type: "public-key" },
    }),
  });

  const response = await handleWalletVerifyRequest(request, {
    verifyLogin: async () => ({
      walletAddress: "0x1111111111111111111111111111111111111111",
      authenticationMethod: "CIRCLE_SESSION",
    }),
    upsertUser: async () => ({
      id: "owner-1",
      walletAddress: "0x1111111111111111111111111111111111111111",
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    owner: {
      ownerId: string;
      walletAddress: string;
      username: string;
      authenticationMethod: string;
    };
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.owner.ownerId, "owner-1");
  assert.equal(payload.owner.walletAddress, "0x1111111111111111111111111111111111111111");
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /accessmesh_agent_owner_session=/i);
});

test("wallet verify rejects invalid authentication", async () => {
  const request = new Request("http://localhost/api/auth/wallet/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "accessmesh",
      credential: { id: "credential-1", type: "public-key" },
    }),
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await handleWalletVerifyRequest(request, {
      verifyLogin: async () => {
        throw new Error("signature mismatch");
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "AUTH_FAILED",
        message: "wallet authentication failed",
      },
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("session and logout routes round-trip the secure cookie", async () => {
  const payload = createAgentOwnerSessionPayload({
    ownerId: "owner-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    username: "accessmesh",
    authenticationMethod: "CIRCLE_SESSION",
  });
  const cookie = `accessmesh_agent_owner_session=${encodeAgentOwnerSession(payload)}`;

  const sessionResponse = await getAgentOwnerSession(
    new Request("http://localhost/api/auth/session", {
      headers: {
        cookie,
      },
    }),
  );

  assert.equal(sessionResponse.status, 200);
  const sessionPayload = (await sessionResponse.json()) as {
    ok: boolean;
    authenticated: boolean;
    owner: { ownerId: string } | null;
  };

  assert.equal(sessionPayload.authenticated, true);
  assert.equal(sessionPayload.owner?.ownerId, "owner-1");

  const logoutResponse = await logoutAgentOwnerSession();

  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});

test("another owner cannot read an execution", async () => {
  const request = new Request("http://localhost/api/agent/executions/execution-1", {
    headers: {
      cookie:
        "accessmesh_agent_owner_session=" +
        encodeAgentOwnerSession(
          createAgentOwnerSessionPayload({
            ownerId: "owner-1",
            walletAddress: "0x1111111111111111111111111111111111111111",
            username: "accessmesh",
            authenticationMethod: "CIRCLE_SESSION",
          }),
        ),
    },
  });

  const owned = await getOwnedAgentExecution(
    request,
    "execution-1",
    {
      async getExecutionById() {
        return {
          id: "execution-1",
          agentId: "agent-1",
          goal: "goal",
          status: "RUNNING",
          decision: null,
          selectedResourceId: null,
          reasoning: null,
          estimatedCostUSDC: null,
          txHash: null,
          startedAt: "2026-07-28T12:00:00.000Z",
          completedAt: null,
        };
      },
    } as never,
    {
      async getAgentOwnerWalletByExecution() {
        return "0x2222222222222222222222222222222222222222";
      },
    },
  );

  assert.equal(owned, null);
});

test("unauthenticated execution reads are rejected", async () => {
  const response = await getAgentExecution(
    new Request("http://localhost/api/agent/executions/execution-1"),
    { params: Promise.resolve({ id: "execution-1" }) },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "authentication required",
  });
});
