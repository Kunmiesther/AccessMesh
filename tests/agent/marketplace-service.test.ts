import test from "node:test";
import assert from "node:assert/strict";
import {
  listAgentMarketplaceCandidates,
  mapPrismaResourceToAgentResourceCandidate,
  normalizeAgentResourceLimit,
  parseAgentTopics,
} from "../../services/agent/AgentMarketplaceService";

test("safely parses valid aiTopics JSON", () => {
  assert.deepEqual(parseAgentTopics('["guide","agent","runtime"]'), [
    "guide",
    "agent",
    "runtime",
  ]);
});

test("invalid aiTopics becomes an empty array", () => {
  assert.deepEqual(parseAgentTopics("not-json"), []);
  assert.deepEqual(parseAgentTopics(null), []);
  assert.deepEqual(parseAgentTopics(undefined), []);
});

test("title falls back to name", () => {
  const candidate = mapPrismaResourceToAgentResourceCandidate({
    id: "r1",
    title: "   ",
    name: "Fallback Name",
    description: "desc",
    priceUSDC: 1,
    resourceType: "",
    type: "CONTENT",
    category: "CONTENT",
    aiSummary: null,
    aiTopics: "[]",
    aiCategory: null,
    aiCollection: null,
    aiPlacement: null,
    aiReasoning: null,
    publishedAt: new Date("2026-07-24T00:00:00.000Z"),
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(candidate.title, "Fallback Name");
});

test("resource type falls back sensibly", () => {
  const candidate = mapPrismaResourceToAgentResourceCandidate({
    id: "r2",
    title: "Title",
    name: "Name",
    description: "desc",
    priceUSDC: 1,
    resourceType: " ",
    type: "TOOL",
    category: "CONTENT",
    aiSummary: null,
    aiTopics: "[]",
    aiCategory: null,
    aiCollection: null,
    aiPlacement: null,
    aiReasoning: null,
    publishedAt: new Date("2026-07-24T00:00:00.000Z"),
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(candidate.resourceType, "TOOL");
});

test("normalizes resource limits safely", () => {
  assert.equal(normalizeAgentResourceLimit(undefined), 50);
  assert.equal(normalizeAgentResourceLimit(150), 100);
  assert.equal(normalizeAgentResourceLimit(7.8), 7);
  assert.equal(normalizeAgentResourceLimit(0), 1);
});

test("listAgentMarketplaceCandidates maps only required metadata", async () => {
  const prisma = {
    resource: {
      async findMany() {
        return [
          {
            id: "r3",
            title: "   ",
            name: "Safe Resource",
            description: "desc",
            priceUSDC: 1,
            resourceType: "",
            type: "CONTENT",
            category: "CONTENT",
            aiSummary: "summary",
            aiTopics: '["alpha","beta"]',
            aiCategory: "category",
            aiCollection: "collection",
            aiPlacement: "placement",
            aiReasoning: "reasoning",
            publishedAt: new Date("2026-07-24T00:00:00.000Z"),
            createdAt: new Date("2026-07-23T00:00:00.000Z"),
            resourceContent: "secret",
            endpoint: "private",
          },
        ];
      },
    },
  };

  const candidates = await listAgentMarketplaceCandidates(
    { limit: 999 },
    { prisma: prisma as never },
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].title, "Safe Resource");
  assert.deepEqual(candidates[0].aiTopics, ["alpha", "beta"]);
  assert.equal((candidates[0] as Record<string, unknown>).resourceContent, undefined);
  assert.equal((candidates[0] as Record<string, unknown>).endpoint, undefined);
});
