import { InputError } from "@/lib/validation";
import { listOwnedResourcesForAdvisor } from "@/services/purchaseService";
import { getResourceDetail } from "@/services/resourceService";
import type {
  UnlockAdvisorDifficulty,
  UnlockAdvisorRecommendation,
  UnlockAdvisorResult,
} from "@/types";

export const AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE =
  "AI advisor unavailable. You can still unlock this resource normally.";

const DEFAULT_DIFFICULTY: UnlockAdvisorDifficulty = "Intermediate";
const DEFAULT_RECOMMENDATION: UnlockAdvisorRecommendation = "CONSIDER";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.AI_PROVIDER_MODEL || "gpt-4.1-mini";

type AdvisorGenerationResult =
  | {
      ok: true;
      advisor: UnlockAdvisorResult;
    }
  | {
      ok: false;
      message: string;
    };

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function generateUnlockAdvisor(params: {
  resourceId: string;
  wallet?: string | null;
}): Promise<AdvisorGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE,
    };
  }

  const resource = await getResourceDetail(params.resourceId, params.wallet);
  if (!resource || !resource.isActive) {
    throw new InputError("resource not found");
  }

  const ownedResources = params.wallet
    ? await listOwnedResourcesForAdvisor(params.wallet, params.resourceId).catch(
        () => [],
      )
    : [];

  try {
    const rawContent = await requestOpenAiAdvisor({
      apiKey,
      payload: {
        resource: {
          id: resource.id,
          title: resource.title || resource.name,
          description: resource.description,
          previewText: resource.previewText || null,
          priceUSDC: resource.priceUSDC,
          category: resource.resourceCategory || resource.category,
          tags: resource.tags,
          creator:
            resource.creatorDisplayName?.trim() || resource.creatorWallet,
        },
        ownedResources:
          ownedResources.length > 0
            ? ownedResources.map((item) => ({
                title: item.title,
                description: item.description,
                category: item.category,
                creator: item.creator,
                tags: item.tags,
                priceUSDC: item.priceUSDC,
              }))
            : [],
      },
    });

    return {
      ok: true,
      advisor: sanitizeAdvisorResult(
        extractJsonObject(rawContent),
        ownedResources.length > 0,
      ),
    };
  } catch (error) {
    console.error("AI unlock advisor failed", error);
    return {
      ok: false,
      message: AI_UNLOCK_ADVISOR_UNAVAILABLE_MESSAGE,
    };
  }
}

async function requestOpenAiAdvisor(params: {
  apiKey: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You are the AccessMesh AI Unlock Advisor. Decide whether a paid resource is worth unlocking. Make a purchase judgment, not a generic summary. Use only the supplied data. Be skeptical about weak descriptions, vague value, thin previews, inflated prices, and overlap with owned resources. Return JSON only with keys recommendation, confidence, valueScore, difficulty, bestFor, reason, possibleOverlap, priceAssessment, agentDecisionSummary. recommendation must be BUY, CONSIDER, or SKIP. difficulty must be Beginner, Intermediate, or Advanced.",
        },
        {
          role: "user",
          content: JSON.stringify(params.payload),
        },
      ],
    }),
  });

  const body = (await response.json()) as OpenAIChatResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || "OpenAI request failed");
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not contain advisor JSON");
  }

  return content;
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Advisor JSON could not be parsed");
    }

    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  }
}

function sanitizeAdvisorResult(
  value: Record<string, unknown>,
  hasOwnedResources: boolean,
): UnlockAdvisorResult {
  const recommendation = sanitizeRecommendation(value.recommendation);
  const reason = sanitizeText(
    value.reason,
    "Insufficient signal to make a confident purchase recommendation.",
  );
  const possibleOverlap = sanitizeText(
    value.possibleOverlap,
    hasOwnedResources
      ? "No significant overlap detected from the owned-resource context."
      : "No owned-resource comparison available.",
  );
  const priceAssessment = sanitizeText(
    value.priceAssessment,
    "Price assessment unavailable from the current metadata.",
  );

  return {
    recommendation,
    confidence: clampScore(value.confidence, 58),
    valueScore: clampScore(value.valueScore, 55),
    difficulty: sanitizeDifficulty(value.difficulty),
    bestFor: sanitizeBestFor(value.bestFor),
    reason,
    possibleOverlap,
    priceAssessment,
    agentDecisionSummary: sanitizeText(
      value.agentDecisionSummary,
      `${recommendation}: ${reason}`,
    ),
  };
}

function sanitizeRecommendation(value: unknown): UnlockAdvisorRecommendation {
  if (typeof value !== "string") {
    return DEFAULT_RECOMMENDATION;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "BUY" ||
    normalized === "CONSIDER" ||
    normalized === "SKIP"
  ) {
    return normalized;
  }

  return DEFAULT_RECOMMENDATION;
}

function sanitizeDifficulty(value: unknown): UnlockAdvisorDifficulty {
  if (typeof value !== "string") {
    return DEFAULT_DIFFICULTY;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "beginner") {
    return "Beginner";
  }

  if (normalized === "advanced") {
    return "Advanced";
  }

  if (normalized === "intermediate") {
    return "Intermediate";
  }

  return DEFAULT_DIFFICULTY;
}

function clampScore(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function sanitizeBestFor(value: unknown) {
  if (!Array.isArray(value)) {
    return ["Buyers who want a fast value judgment before unlocking."];
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);

  return items.length > 0
    ? items
    : ["Buyers who want a fast value judgment before unlocking."];
}

function sanitizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}
