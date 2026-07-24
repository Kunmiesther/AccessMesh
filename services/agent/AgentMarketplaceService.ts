import type { AgentResourceCandidate } from "./types";

export type AgentMarketplaceResourceRecord = {
  id: string;
  title: string | null;
  name: string | null;
  description: string;
  priceUSDC: number;
  resourceType: string | null;
  type?: string | null;
  category?: string | null;
  aiSummary: string | null;
  aiTopics: unknown;
  aiCategory: string | null;
  aiCollection: string | null;
  aiPlacement: string | null;
  aiReasoning: string | null;
  publishedAt: Date | string | null;
  createdAt: Date | string;
};

type AgentMarketplacePrismaClient = {
  resource: {
    findMany(args: {
      where: {
        isActive: boolean;
        publishedAt: { not: null };
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      take: number;
      select: Record<string, boolean>;
    }): Promise<AgentMarketplaceResourceRecord[]>;
  };
};

const AGENT_MARKETPLACE_SELECT = {
  id: true,
  title: true,
  name: true,
  description: true,
  priceUSDC: true,
  resourceType: true,
  type: true,
  category: true,
  aiSummary: true,
  aiTopics: true,
  aiCategory: true,
  aiCollection: true,
  aiPlacement: true,
  aiReasoning: true,
  publishedAt: true,
  createdAt: true,
} satisfies Record<string, boolean>;

export function normalizeAgentResourceLimit(limit?: number) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return 50;
  }

  const normalized = Math.floor(limit);
  if (normalized < 1) {
    return 1;
  }

  return Math.min(normalized, 100);
}

export function parseAgentTopics(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function mapPrismaResourceToAgentResourceCandidate(
  resource: AgentMarketplaceResourceRecord,
): AgentResourceCandidate {
  return {
    id: resource.id,
    title: normalizeOptionalText(resource.title) ?? normalizeOptionalText(resource.name) ?? resource.id,
    description: resource.description,
    priceUSDC: resource.priceUSDC,
    resourceType:
      normalizeOptionalText(resource.resourceType) ??
      normalizeOptionalText(resource.type) ??
      normalizeOptionalText(resource.category) ??
      "CONTENT",
    aiSummary: normalizeOptionalText(resource.aiSummary),
    aiTopics: parseAgentTopics(resource.aiTopics),
    aiCategory: normalizeOptionalText(resource.aiCategory),
    aiCollection: normalizeOptionalText(resource.aiCollection),
    aiPlacement: normalizeOptionalText(resource.aiPlacement),
    aiReasoning: normalizeOptionalText(resource.aiReasoning),
    publishedAt: normalizeDate(resource.publishedAt),
    createdAt: normalizeDate(resource.createdAt) ?? new Date().toISOString(),
  };
}

export async function listAgentMarketplaceCandidates(options?: {
  limit?: number;
}, deps?: {
  prisma?: AgentMarketplacePrismaClient;
}): Promise<AgentResourceCandidate[]> {
  const limit = normalizeAgentResourceLimit(options?.limit);
  const prismaClient = deps?.prisma ?? (await import("@/lib/prisma")).prisma;

  const resources = await prismaClient.resource.findMany({
    where: {
      isActive: true,
      publishedAt: {
        not: null,
      },
    },
    orderBy: [
      {
        publishedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: limit,
    select: AGENT_MARKETPLACE_SELECT,
  });

  return resources.map((resource) => mapPrismaResourceToAgentResourceCandidate(resource));
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
