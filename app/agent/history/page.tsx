import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import {
  AgentHistoryFilters,
} from "@/components/agent/history/AgentHistoryFilters";
import { AgentHistoryList } from "@/components/agent/history/AgentHistoryList";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import {
  type AgentExecutionHistoryQuery,
  parseAgentExecutionHistoryQuery,
} from "@/services/agent/AgentExecutionHistory";
import { AgentExecutionRepository } from "@/services/agent/AgentExecutionRepository";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AgentHistoryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const headerStore = await headers();
  const cookieHeader = headerStore.get("cookie");
  const owner = getAgentOwnerFromCookieHeader(cookieHeader);
  const query = parseAgentExecutionHistoryQuery({
    cursor: firstValue(searchParams?.cursor),
    limit: firstValue(searchParams?.limit),
    status: firstValue(searchParams?.status),
    decision: firstValue(searchParams?.decision),
  });

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <header style={heroStyle}>
          <div style={heroCopyStyle}>
            <p style={eyebrowStyle}>Agent History</p>
            <h1 style={titleStyle}>Agent History</h1>
            <p style={leadStyle}>
              Review previous research runs, recommendations, purchases, and unlock outcomes.
            </p>
            <div style={heroActionsStyle}>
              <Link href="/agent" style={primaryLinkStyle}>
                Run Research Agent
              </Link>
              <Link href="/agent/inbox" style={secondaryLinkStyle}>
                View inbox
              </Link>
              <Link href="/agent/notifications" style={secondaryLinkStyle}>
                View notifications
              </Link>
              <Link href="/agent/analytics" style={secondaryLinkStyle}>
                View analytics
              </Link>
              <Link href="/agent/policies" style={secondaryLinkStyle}>
                View policies
              </Link>
              <Link href="/agent/budgets" style={secondaryLinkStyle}>
                View budgets
              </Link>
            </div>
          </div>
        </header>

        {!owner ? (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view your execution history."
            actionHref="/wallet?next=/agent/history"
            actionLabel="Connect Wallet"
          />
        ) : !query.ok ? (
          <StatePanel
            title="Malformed query"
            copy={query.error}
            actionHref="/agent/history"
            actionLabel="Reset filters"
          />
        ) : (
          <HistoryContent ownerId={owner.ownerId} query={query.query} />
        )}
      </main>
    </div>
  );
}

async function HistoryContent({
  ownerId,
  query,
}: {
  ownerId: string;
  query: AgentExecutionHistoryQuery;
}) {
  const repository = new AgentExecutionRepository();
  const page = await repository.listExecutionsForOwner({
    ownerId,
    limit: query.limit,
    cursor: query.cursor,
    status: query.status,
    decision: query.decision,
  });

  return (
    <>
      <AgentHistoryFilters
        status={query.status}
        decision={query.decision}
        limit={query.limit}
      />

      <AgentHistoryList page={page} query={query} />
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
      <h2 style={stateTitleStyle}>{title}</h2>
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

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 20,
} as const;

const heroStyle = {
  display: "grid",
  gap: 18,
} as const;

const heroCopyStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 22,
  display: "grid",
  gap: 14,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const titleStyle = {
  fontSize: "clamp(32px, 5vw, 46px)",
  lineHeight: 1.08,
  color: "var(--text-primary)",
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.75,
  fontSize: 15,
  maxWidth: 760,
} as const;

const heroActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
} as const;

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
