import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../app/api/agent/executions/route";
import {
  createAgentOwnerSessionPayload,
  encodeAgentOwnerSession,
} from "../../lib/auth/agentOwnerSession";
import { AgentExecutionRepository } from "../../services/agent/AgentExecutionRepository";

const owner = {
  ownerId: "owner-1",
  walletAddress: "0x1111111111111111111111111111111111111111",
  username: "accessmesh",
  authenticationMethod: "CIRCLE_SESSION" as const,
};

test("GET /api/agent/executions returns 401 without authentication", async () => {
  const response = await GET(new Request("http://localhost/api/agent/executions"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "authentication required",
    },
  });
});

test("GET /api/agent/executions returns 400 for malformed filters", async () => {
  const original = AgentExecutionRepository.prototype.listExecutionsForOwner;
  let called = false;
  AgentExecutionRepository.prototype.listExecutionsForOwner = async () => {
    called = true;
    return { executions: [], nextCursor: null, hasMore: false };
  };

  try {
    const cookie = encodeAgentOwnerSession(
      createAgentOwnerSessionPayload(owner),
    );
    const request = new Request("http://localhost/api/agent/executions?status=invalid", {
      headers: {
        cookie: `accessmesh_agent_owner_session=${cookie}`,
      },
    });

    const response = await GET(request);
    assert.equal(response.status, 400);
    assert.equal(called, false);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "INVALID_QUERY",
        message: "status is invalid",
      },
    });
  } finally {
    AgentExecutionRepository.prototype.listExecutionsForOwner = original;
  }
});

test("GET /api/agent/executions returns safe summaries for the authenticated owner", async () => {
  const original = AgentExecutionRepository.prototype.listExecutionsForOwner;

  let capturedInput:
    | {
        ownerId: string;
        limit?: number;
        cursor?: { startedAt: string; id: string } | null;
        status?: string;
        decision?: string;
      }
    | null = null;

  AgentExecutionRepository.prototype.listExecutionsForOwner = async function (input) {
    capturedInput = input;
    return {
      executions: [
        {
          id: "exec-1",
          goal: "Safe goal",
          status: "COMPLETED",
          decision: "BUY",
          policyId: "policy-1",
          policyName: "Balanced Buyer",
          policyVersion: 1,
          selectedResourceId: "resource-1",
          selectedResourceTitle: "Safe Resource",
          estimatedCostUSDC: 0.2,
          txHash: "0xabc123",
          createdAt: "2026-07-28T12:00:00.000Z",
          updatedAt: "2026-07-28T12:05:00.000Z",
          completedAt: "2026-07-28T12:05:00.000Z",
          failureCode: null,
          failureStage: null,
          purchaseStatus: "COMPLETED",
          settlementStatus: "SETTLED",
          unlockStatus: "UNLOCKED",
        },
      ],
      nextCursor: "cursor-token",
      hasMore: true,
    };
  };

  try {
    const cookie = encodeAgentOwnerSession(
      createAgentOwnerSessionPayload(owner),
    );
    const request = new Request(
      "http://localhost/api/agent/executions?limit=2&decision=BUY&status=completed",
      {
        headers: {
          cookie: `accessmesh_agent_owner_session=${cookie}`,
        },
      },
    );

    const response = await GET(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      ok: true,
      executions: [
        {
          id: "exec-1",
          goal: "Safe goal",
          status: "COMPLETED",
          decision: "BUY",
          policyId: "policy-1",
          policyName: "Balanced Buyer",
          policyVersion: 1,
          selectedResourceId: "resource-1",
          selectedResourceTitle: "Safe Resource",
          estimatedCostUSDC: 0.2,
          txHash: "0xabc123",
          createdAt: "2026-07-28T12:00:00.000Z",
          updatedAt: "2026-07-28T12:05:00.000Z",
          completedAt: "2026-07-28T12:05:00.000Z",
          failureCode: null,
          failureStage: null,
          purchaseStatus: "COMPLETED",
          settlementStatus: "SETTLED",
          unlockStatus: "UNLOCKED",
        },
      ],
      pageInfo: {
        nextCursor: "cursor-token",
        hasMore: true,
      },
    });

    assert.deepEqual(capturedInput, {
      ownerId: "owner-1",
      limit: 2,
      cursor: null,
      status: "completed",
      decision: "BUY",
    });
  } finally {
    AgentExecutionRepository.prototype.listExecutionsForOwner = original;
  }
});
