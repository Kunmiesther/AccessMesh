import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/validation";
import { serializeResource } from "@/services/resourceService";
import type {
  AccessMeshIntelligenceCollection,
  AccessMeshIntelligenceMetadata,
  AccessMeshIntelligencePlacement,
  ResourceMeta,
} from "@/types";

const GEMINI_MODEL = "gemini-2.5-flash";

const PLACEMENTS: AccessMeshIntelligencePlacement[] = [
  "Featured",
  "Emerging",
  "Infrastructure",
  "AI Agents",
  "Payments",
  "Developer Tools",
  "Research",
  "Beginner Friendly",
];

const PLACEMENT_ORDER = new Map(
  PLACEMENTS.map((placement, index) => [placement, index]),
);

// AccessMesh Intelligence is the marketplace discovery layer: it classifies
// resources, groups them into collections, and exposes agent-readable context.
export async function analyzeResourceIntelligence(resourceId: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new InputError("GEMINI_API_KEY is required for AccessMesh Intelligence");
  }

  const targetResource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!targetResource || !targetResource.isActive) {
    throw new InputError("resource not found or inactive");
  }

  const contextResources = await prisma.resource.findMany({
    where: {
      isActive: true,
      NOT: { id: resourceId },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 18,
  });

  const targetMeta = serializeResource(targetResource);
  const contextMeta = contextResources.map((resource) => serializeResource(resource));
  const rawResult = await requestGeminiIntelligence({
    target: targetMeta,
    candidates: contextMeta,
  });
  const sanitized = sanitizeIntelligenceResult(rawResult, contextMeta, targetMeta.id);

  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data: {
      aiSummary: sanitized.aiSummary ?? null,
      aiTopics: stringifyStringArray(sanitized.aiTopics),
      aiCategory: sanitized.aiCategory ?? null,
      aiAudience: sanitized.aiAudience ?? null,
      aiCollection: sanitized.aiCollection ?? null,
      aiPlacement: sanitized.aiPlacement ?? null,
      aiRelatedResourceIds: stringifyStringArray(sanitized.aiRelatedResourceIds),
      aiReasoning: sanitized.aiReasoning ?? null,
      aiAnalyzedAt: new Date(),
    },
  });

  return buildIntelligenceMetadata(updated, contextMeta);
}

export async function backfillAccessMeshIntelligence(params?: {
  limit?: number;
  force?: boolean;
}) {
  const limit = normalizeBackfillLimit(params?.limit);
  const force = params?.force === true;

  const resources = await prisma.resource.findMany({
    where: force
      ? {
          isActive: true,
          publishedAt: {
            not: null,
          },
        }
      : {
          isActive: true,
          publishedAt: {
            not: null,
          },
          OR: [
            {
              aiAnalyzedAt: null,
            },
            {
              aiSummary: null,
            },
          ],
        },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  const results: Array<{
    resourceId: string;
    status: "analyzed" | "skipped" | "failed";
    error?: string;
  }> = [];
  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const resource of resources) {
    if (!force && resource.aiAnalyzedAt && resource.aiSummary) {
      skipped += 1;
      results.push({
        resourceId: resource.id,
        status: "skipped",
      });
      continue;
    }

    try {
      await analyzeResourceIntelligence(resource.id);
      analyzed += 1;
      results.push({
        resourceId: resource.id,
        status: "analyzed",
      });
    } catch (error) {
      failed += 1;
      results.push({
        resourceId: resource.id,
        status: "failed",
        error: error instanceof Error ? error.message : "analysis failed",
      });
    }
  }

  return {
    ok: true as const,
    analyzed,
    skipped,
    failed,
    results,
  };
}

export async function listAccessMeshIntelligenceCollections() {
  const resources = await prisma.resource.findMany({
    where: {
      isActive: true,
      publishedAt: {
        not: null,
      },
      aiAnalyzedAt: {
        not: null,
      },
      OR: [
        {
          aiCollection: {
            not: null,
          },
        },
        {
          aiPlacement: {
            not: null,
          },
        },
      ],
    },
    orderBy: [{ aiCollection: "asc" }, { aiPlacement: "asc" }, { createdAt: "desc" }],
  });

  if (resources.length === 0) {
    return [] satisfies AccessMeshIntelligenceCollection[];
  }

  const serialized = resources.map((resource) => serializeResource(resource));
  const collections = new Map<string, AccessMeshIntelligenceCollection>();

  for (const resource of serialized) {
    const groupTitle = resource.aiCollection || resource.aiPlacement;
    if (!groupTitle) {
      continue;
    }

    const key = resource.aiCollection ? `collection:${groupTitle}` : `placement:${groupTitle}`;
    const existing = collections.get(key);

    if (existing) {
      existing.resources.push(resource);
      existing.count += 1;
      if (!existing.placement && resource.aiPlacement) {
        existing.placement = resource.aiPlacement;
      }
      continue;
    }

    collections.set(key, {
      title: groupTitle,
      placement: resource.aiPlacement ?? null,
      count: 1,
      resources: [resource],
    });
  }

  return [...collections.values()]
    .map((collection) => ({
      ...collection,
      resources: collection.resources
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    }))
    .sort((a, b) => {
      const placementDiff = getPlacementRank(a.placement) - getPlacementRank(b.placement);

      if (placementDiff !== 0) {
        return placementDiff;
      }

      return a.title.localeCompare(b.title);
    });
}

async function requestGeminiIntelligence(params: {
  target: ResourceMeta;
  candidates: ResourceMeta[];
}) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify({
      resource: toIntelligencePromptResource(params.target),
      marketplaceContext: params.candidates.map(toIntelligencePromptResource),
    }),
    config: {
      systemInstruction:
        "You are AccessMesh Intelligence. Analyze a paid marketplace resource for discovery and organization. Focus on discovery, classification, related resources, and browsing usefulness. Do not judge creator quality. Do not produce buy or skip decisions. Do not assign confidence scores. Do not use qualityScore. Return JSON only with keys summary, topics, category, audience, collection, placement, relatedResourceIds, reasoning. placement must be one of Featured, Emerging, Infrastructure, AI Agents, Payments, Developer Tools, Research, Beginner Friendly. relatedResourceIds must come only from the supplied marketplace context. Omit fields that are not well supported by the input rather than inventing them.",
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: intelligenceResponseJsonSchema,
    },
  });

  if (!response.text) {
    throw new Error("Gemini did not return AccessMesh Intelligence JSON");
  }

  return extractJsonObject(response.text);
}

function sanitizeIntelligenceResult(
  value: Record<string, unknown>,
  candidates: ResourceMeta[],
  resourceId: string,
) {
  const candidateIds = new Set(candidates.map((resource) => resource.id));
  const aiRelatedResourceIds = sanitizeStringArray(value.relatedResourceIds)
    .filter((id) => id !== resourceId && candidateIds.has(id))
    .slice(0, 6);

  return {
    aiSummary: sanitizeOptionalText(value.summary),
    aiTopics: sanitizeStringArray(value.topics).slice(0, 8),
    aiCategory: sanitizeOptionalText(value.category),
    aiAudience: sanitizeOptionalText(value.audience),
    aiCollection: sanitizeOptionalText(value.collection),
    aiPlacement: sanitizePlacement(value.placement),
    aiRelatedResourceIds,
    aiReasoning: sanitizeOptionalText(value.reasoning),
  } satisfies AccessMeshIntelligenceMetadata;
}

function buildIntelligenceMetadata(
  resource: {
    aiSummary: string | null;
    aiTopics: string | null;
    aiCategory: string | null;
    aiAudience: string | null;
    aiCollection: string | null;
    aiPlacement: string | null;
    aiRelatedResourceIds: string | null;
    aiReasoning: string | null;
    aiAnalyzedAt: Date | null;
  },
  relatedCandidates: ResourceMeta[],
) {
  const relatedIds = parseStoredStringArray(resource.aiRelatedResourceIds);
  const relatedById = new Map(relatedCandidates.map((item) => [item.id, item]));

  return {
    aiSummary: resource.aiSummary,
    aiTopics: parseStoredStringArray(resource.aiTopics),
    aiCategory: resource.aiCategory,
    aiAudience: resource.aiAudience,
    aiCollection: resource.aiCollection,
    aiPlacement: sanitizePlacement(resource.aiPlacement),
    aiRelatedResourceIds: relatedIds,
    aiReasoning: resource.aiReasoning,
    aiAnalyzedAt: resource.aiAnalyzedAt?.toISOString() ?? null,
    aiRelatedResources: relatedIds
      .map((id) => relatedById.get(id))
      .filter((item): item is ResourceMeta => Boolean(item))
      .map((item) => ({
        id: item.id,
        title: item.title || item.name,
        priceUSDC: item.priceUSDC,
        creatorWallet: item.creatorWallet,
        creatorDisplayName: item.creatorDisplayName,
      })),
  } satisfies AccessMeshIntelligenceMetadata;
}

function toIntelligencePromptResource(resource: ResourceMeta) {
  return {
    id: resource.id,
    title: resource.title || resource.name,
    description: resource.description,
    previewText: resource.previewText || null,
    priceUSDC: resource.priceUSDC,
    category: resource.resourceCategory || resource.category,
    tags: resource.tags,
    creator: resource.creatorDisplayName || resource.creatorWallet,
    publishedAt: resource.publishedAt || resource.createdAt,
  };
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AccessMesh Intelligence JSON could not be parsed");
    }

    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
}

function sanitizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function sanitizePlacement(value: unknown): AccessMeshIntelligencePlacement | null {
  return typeof value === "string" && PLACEMENTS.includes(value as AccessMeshIntelligencePlacement)
    ? (value as AccessMeshIntelligencePlacement)
    : null;
}

function parseStoredStringArray(value: string | null | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

function stringifyStringArray(value: string[] | undefined) {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

function normalizeBackfillLimit(value: number | undefined) {
  if (!Number.isFinite(value ?? NaN)) {
    return 10;
  }

  const normalized = Math.max(1, Math.min(100, Math.floor(value ?? 10)));
  return normalized;
}

function getPlacementRank(value: AccessMeshIntelligencePlacement | null) {
  return value ? PLACEMENT_ORDER.get(value) ?? 999 : 999;
}

const intelligenceResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    topics: {
      type: "array",
      items: { type: "string" },
    },
    category: { type: "string" },
    audience: { type: "string" },
    collection: { type: "string" },
    placement: {
      type: "string",
      enum: PLACEMENTS,
    },
    relatedResourceIds: {
      type: "array",
      items: { type: "string" },
    },
    reasoning: { type: "string" },
  },
} as const;
