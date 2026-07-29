import { InputError } from "@/lib/validation";
import type {
  AgentNotificationFilter,
  AgentNotificationPage,
  AgentNotificationSummaryView,
  AgentNotificationType,
} from "./AgentNotificationTypes";
import { toAgentNotificationSummary } from "./AgentNotificationViews";

type PrismaLikeRecord = Record<string, unknown>;

const NOTIFICATION_SELECT = {
  id: true,
  ownerId: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  actionPath: true,
  dedupeKey: true,
  readAt: true,
  createdAt: true,
} satisfies Record<string, boolean>;

export type AgentNotificationRepositoryClient = {
  agentNotification: {
    findUnique(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord | null>;
    findMany(args: {
      where?: PrismaLikeRecord;
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>;
      take?: number;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord[]>;
    create(args: {
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    update(args: {
      where: { id: string };
      data: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    upsert(args: {
      where: { dedupeKey: string };
      create: PrismaLikeRecord;
      update: PrismaLikeRecord;
      select: Record<string, boolean>;
    }): Promise<PrismaLikeRecord>;
    updateMany(args: {
      where?: PrismaLikeRecord;
      data: PrismaLikeRecord;
    }): Promise<{ count: number }>;
    count(args: { where?: PrismaLikeRecord }): Promise<number>;
  };
  $transaction?<T>(fn: (tx: AgentNotificationRepositoryClient) => Promise<T>): Promise<T>;
};

export type EnsureAgentNotificationInput = Readonly<{
  ownerId: string;
  type: AgentNotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionPath?: string | null;
  dedupeKey?: string | null;
}>;

export type AgentNotificationCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

export type AgentNotificationListInput = Readonly<{
  ownerId: string;
  limit?: number;
  cursor?: AgentNotificationCursor | null;
  filter?: AgentNotificationFilter;
}>;

export function encodeAgentNotificationCursor(cursor: AgentNotificationCursor) {
  return base64UrlEncode(JSON.stringify(cursor));
}

export function decodeAgentNotificationCursor(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return null;
    }

    const createdAt = new Date(record.createdAt);
    if (!Number.isFinite(createdAt.getTime())) {
      return null;
    }

    const id = record.id.trim();
    if (!id) {
      return null;
    }

    return {
      createdAt: createdAt.toISOString(),
      id,
    } satisfies AgentNotificationCursor;
  } catch {
    return null;
  }
}

export class AgentNotificationRepository {
  constructor(private readonly clientFactory?: () => Promise<AgentNotificationRepositoryClient>) {}

  async listNotificationsForOwner(input: AgentNotificationListInput): Promise<AgentNotificationPage> {
    const client = await this.getClient();
    const limit = normalizeLimit(input.limit);
    const cursor = input.cursor ?? null;
    const filter = input.filter ?? "all";
    const where: PrismaLikeRecord = {
      ownerId: input.ownerId,
    };

    if (filter === "unread") {
      where.readAt = null;
    }

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursor.id } },
      ];
    }

    const records = await client.agentNotification.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      select: NOTIFICATION_SELECT,
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const notifications = pageRecords.map((record) => this.mapNotification(record));
    const lastRecord = pageRecords[pageRecords.length - 1];

    return {
      notifications,
      nextCursor: hasMore && lastRecord ? encodeAgentNotificationCursor(encodeCursor(lastRecord)) : null,
      hasMore,
    };
  }

  async getNotificationForOwner(ownerId: string, notificationId: string) {
    const client = await this.getClient();
    const record = await client.agentNotification.findUnique({
      where: { id: notificationId },
      select: NOTIFICATION_SELECT,
    });

    if (!record || String(record.ownerId) !== ownerId) {
      return null;
    }

    return this.mapNotification(record);
  }

  async getUnreadCount(ownerId: string) {
    const client = await this.getClient();
    const count = await client.agentNotification.count({
      where: {
        ownerId,
        readAt: null,
      },
    });

    return count;
  }

  async markNotificationAsRead(ownerId: string, notificationId: string) {
    const client = await this.getClient();
    const record = await client.agentNotification.findUnique({
      where: { id: notificationId },
      select: NOTIFICATION_SELECT,
    });

    if (!record || String(record.ownerId) !== ownerId) {
      return null;
    }

    if (record.readAt !== null && record.readAt !== undefined) {
      return this.mapNotification(record);
    }

    const updated = await client.agentNotification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
      select: NOTIFICATION_SELECT,
    });

    return this.mapNotification(updated);
  }

  async markAllNotificationsAsRead(ownerId: string) {
    const client = await this.getClient();
    const result = await client.agentNotification.updateMany({
      where: {
        ownerId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count;
  }

  async ensureNotification(input: EnsureAgentNotificationInput) {
    const client = await this.getClient();
    return ensureNotificationRecord(client, input);
  }

  private async getClient() {
    if (this.clientFactory) {
      return this.clientFactory();
    }

    const { prisma } = await import("@/lib/prisma");
    return prisma as unknown as AgentNotificationRepositoryClient;
  }

  private mapNotification(record: PrismaLikeRecord): AgentNotificationSummaryView {
    return toAgentNotificationSummary({
      id: String(record.id),
      ownerId: String(record.ownerId),
      type: String(record.type),
      title: String(record.title),
      message: String(record.message),
      entityType:
        typeof record.entityType === "string" && record.entityType.trim().length > 0
          ? record.entityType
          : null,
      entityId:
        typeof record.entityId === "string" && record.entityId.trim().length > 0
          ? record.entityId
          : null,
      actionPath:
        typeof record.actionPath === "string" && record.actionPath.trim().length > 0
          ? record.actionPath
          : null,
      dedupeKey:
        typeof record.dedupeKey === "string" && record.dedupeKey.trim().length > 0
          ? record.dedupeKey
          : null,
      readAt: record.readAt as Date | string | null,
      createdAt: record.createdAt as Date | string,
    });
  }
}

export async function ensureNotificationRecord(
  client: AgentNotificationRepositoryClient,
  input: EnsureAgentNotificationInput,
) {
  const title = normalizeText(input.title, 120, "title");
  const message = normalizeText(input.message, 320, "message");
  const actionPath = normalizeActionPath(input.actionPath);
  const entityType = normalizeOptionalText(input.entityType, 40);
  const entityId = normalizeOptionalText(input.entityId, 120);
  const dedupeKey = normalizeOptionalText(input.dedupeKey, 160);

  if (dedupeKey) {
    const record = await client.agentNotification.upsert({
      where: { dedupeKey },
      create: {
        ownerId: input.ownerId,
        type: input.type,
        title,
        message,
        entityType,
        entityId,
        actionPath,
        dedupeKey,
      },
      update: {
        title,
        message,
        entityType,
        entityId,
        actionPath,
      },
      select: NOTIFICATION_SELECT,
    });

    return record;
  }

  return client.agentNotification.create({
    data: {
      ownerId: input.ownerId,
      type: input.type,
      title,
      message,
      entityType,
      entityId,
      actionPath,
    },
    select: NOTIFICATION_SELECT,
  });
}

function normalizeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 20;
  }

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function encodeCursor(record: PrismaLikeRecord) {
  return {
    createdAt: toIsoString(record.createdAt),
    id: String(record.id),
  } satisfies AgentNotificationCursor;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date().toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  }

  return new Date().toISOString();
}

function normalizeText(value: string, maxLength: number, field: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new InputError(`${field} is required`);
  }

  if (trimmed.length > maxLength) {
    throw new InputError(`${field} is too long`);
  }

  if (/[<>]/.test(trimmed)) {
    throw new InputError(`${field} must be plain text`);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeActionPath(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    throw new InputError("actionPath must be an internal route");
  }

  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
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
