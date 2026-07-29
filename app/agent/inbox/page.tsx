import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { AgentApprovalInboxHeader } from "@/components/agent/approvals/AgentApprovalInboxHeader";
import { AgentApprovalList } from "@/components/agent/approvals/AgentApprovalList";
import { AgentApprovalEmptyState } from "@/components/agent/approvals/AgentApprovalEmptyState";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { parseAgentApprovalListQuery } from "@/services/agent/AgentApprovalValidation";
import { AgentApprovalRepository } from "@/services/agent/AgentApprovalRepository";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AgentInboxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));
  const query = parseAgentApprovalListQuery({
    cursor: firstValue(searchParams?.cursor),
    limit: firstValue(searchParams?.limit),
    status: firstValue(searchParams?.status),
  });

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        {owner ? (
          query.ok ? (
            <InboxContent ownerId={owner.ownerId} query={query.query} />
          ) : (
            <StatePanel
              title="Malformed query"
              copy={query.error}
              actionHref="/agent/inbox"
              actionLabel="Reset filters"
            />
          )
        ) : (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to review approval items."
            actionHref="/wallet?next=/agent/inbox"
            actionLabel="Connect Wallet"
          />
        )}
      </main>
    </div>
  );
}

async function InboxContent({
  ownerId,
  query,
}: {
  ownerId: string;
  query: {
    limit: number;
    cursor: { createdAt: string; id: string } | null;
    status: "all" | "pending" | "resolved";
  };
}) {
  const repository = new AgentApprovalRepository();
  const pendingPage = await repository.listApprovalsForOwner({
    ownerId,
    limit: query.limit,
    cursor: query.cursor,
    status: "pending",
  });
  const resolvedPage = await repository.listApprovalsForOwner({
    ownerId,
    limit: 5,
    cursor: null,
    status: "resolved",
  });
  const pendingCount = await repository.getPendingApprovalCount(ownerId);

  return (
    <>
      <AgentApprovalInboxHeader pendingCount={pendingCount} />

      <section style={navigationPanelStyle} aria-label="Navigation">
        <div style={navigationRowStyle}>
          <Link href="/agent" style={navigationLinkStyle}>
            Run Agent
          </Link>
          <Link href="/agent/history" style={navigationLinkStyle}>
            History
          </Link>
          <Link href="/agent/analytics" style={navigationLinkStyle}>
            Analytics
          </Link>
          <Link href="/agent/notifications" style={navigationLinkStyle}>
            Notifications
          </Link>
        </div>
      </section>

      <AgentApprovalList
        approvals={pendingPage.approvals}
        nextCursor={pendingPage.nextCursor}
        emptyTitle="No pending approvals"
        emptyCopy="BUY recommendations will appear here when they are ready for owner review."
      />

      <section style={resolvedPanelStyle} aria-label="Resolved approvals">
        <div style={resolvedHeaderStyle}>
          <div>
            <p style={resolvedEyebrowStyle}>Recent resolved approvals</p>
            <h2 style={resolvedTitleStyle}>Recent decisions</h2>
          </div>
        </div>

        {resolvedPage.approvals.length > 0 ? (
          <AgentApprovalList
            approvals={resolvedPage.approvals}
            nextCursor={null}
            readOnly
            emptyTitle="No resolved approvals yet"
            emptyCopy="Approved and rejected items will appear here."
          />
        ) : (
          <AgentApprovalEmptyState
            title="No resolved approvals yet"
            copy="Approved and rejected items will appear here."
          />
        )}
      </section>
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

const resolvedPanelStyle = {
  display: "grid",
  gap: 16,
} as const;

const resolvedHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const resolvedEyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const resolvedTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
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
