import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { AgentNotificationInboxHeader } from "@/components/agent/notifications/AgentNotificationInboxHeader";
import { AgentNotificationList } from "@/components/agent/notifications/AgentNotificationList";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { AgentNotificationRepository, decodeAgentNotificationCursor } from "@/services/agent/AgentNotificationRepository";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AgentNotificationsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const filter = parseFilter(firstValue(searchParams?.filter));
  const limit = parseLimit(firstValue(searchParams?.limit));
  const cursor = decodeAgentNotificationCursor(firstValue(searchParams?.cursor));

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        {owner ? (
          filter ? (
            <NotificationsContent ownerId={owner.ownerId} filter={filter} limit={limit} cursor={cursor} />
          ) : (
            <StatePanel
              title="Malformed query"
              copy="The requested notification filter is invalid."
              actionHref="/agent/notifications"
              actionLabel="Reset filters"
            />
          )
        ) : (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view notifications."
            actionHref="/wallet?next=/agent/notifications"
            actionLabel="Connect Wallet"
          />
        )}
      </main>
    </div>
  );
}

async function NotificationsContent({
  ownerId,
  filter,
  limit,
  cursor,
}: {
  ownerId: string;
  filter: "all" | "unread";
  limit: number;
  cursor: { createdAt: string; id: string } | null;
}) {
  const repository = new AgentNotificationRepository();
  const page = await repository.listNotificationsForOwner({
    ownerId,
    filter,
    limit,
    cursor,
  });
  const unreadCount = await repository.getUnreadCount(ownerId);

  return (
    <>
      <AgentNotificationInboxHeader unreadCount={unreadCount} />

      <section style={navigationPanelStyle} aria-label="Navigation">
        <div style={navigationRowStyle}>
          <Link href="/agent" style={navigationLinkStyle}>
            Run Agent
          </Link>
          <Link href="/agent/inbox" style={navigationLinkStyle}>
            Inbox
          </Link>
          <Link href="/agent/history" style={navigationLinkStyle}>
            History
          </Link>
          <Link href="/agent/analytics" style={navigationLinkStyle}>
            Analytics
          </Link>
          <Link href="/agent/policies" style={navigationLinkStyle}>
            Policies
          </Link>
          <Link href="/agent/budgets" style={navigationLinkStyle}>
            Budgets
          </Link>
        </div>
      </section>

      <AgentNotificationList page={page} filter={filter} />
    </>
  );
}

function StatePanel({
  title,
  copy,
  actionHref,
  actionLabel,
}: {
  title: string;
  copy: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section style={statePanelStyle}>
      <h1 style={stateTitleStyle}>{title}</h1>
      <p style={stateCopyStyle}>{copy}</p>
      <Link href={actionHref} style={actionStyle}>
        {actionLabel}
      </Link>
    </section>
  );
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseFilter(value: string | null) {
  if (value === null || value === "" || value === "all") {
    return "all" as const;
  }

  if (value === "unread") {
    return "unread" as const;
  }

  return null;
}

function parseLimit(value: string | null) {
  if (value === null || value === "") {
    return 20;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }

  return Math.min(parsed, 20);
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 20,
} as const;

const navigationPanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 18,
} as const;

const navigationRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
} as const;

const navigationLinkStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;

const statePanelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 22,
  display: "grid",
  gap: 12,
} as const;

const stateTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const stateCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 14,
} as const;

const actionStyle = {
  width: "fit-content",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const;
