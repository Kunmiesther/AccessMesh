import Link from "next/link";
import { headers } from "next/headers";
import { Navbar } from "@/components/Navbar";
import { formatDateTime, formatUSDC } from "@/lib/ui";
import { getAgentOwnerFromCookieHeader } from "@/lib/auth/requireAgentOwner";
import { AgentBudgetService } from "@/services/agent/AgentBudgetService";

export const dynamic = "force-dynamic";

export default async function AgentBudgetsPage() {
  const headerStore = await headers();
  const owner = getAgentOwnerFromCookieHeader(headerStore.get("cookie"));

  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <header style={heroStyle}>
          <div style={heroCopyStyle}>
            <p style={eyebrowStyle}>Agent Budgets</p>
            <h1 style={titleStyle}>Agent Budgets</h1>
            <p style={leadStyle}>
              Track policy spending, active reservations, and available USDC allowances.
            </p>
            <div style={heroActionsStyle}>
              <Link href="/agent" style={primaryLinkStyle}>
                Run Agent
              </Link>
              <Link href="/agent/history" style={secondaryLinkStyle}>
                History
              </Link>
              <Link href="/agent/inbox" style={secondaryLinkStyle}>
                Inbox
              </Link>
              <Link href="/agent/analytics" style={secondaryLinkStyle}>
                Analytics
              </Link>
              <Link href="/agent/policies" style={secondaryLinkStyle}>
                Policies
              </Link>
              <Link href="/agent/notifications" style={secondaryLinkStyle}>
                Notifications
              </Link>
            </div>
          </div>
        </header>

        {!owner ? (
          <StatePanel
            title="Authentication required"
            copy="Connect your Circle Smart Account to view your budget ledger."
            actionHref="/wallet?next=/agent/budgets"
            actionLabel="Connect Wallet"
          />
        ) : (
          <BudgetsContent ownerId={owner.ownerId} />
        )}
      </main>
    </div>
  );
}

async function BudgetsContent({ ownerId }: { ownerId: string }) {
  const service = new AgentBudgetService();
  const summary = await service.getBudgetSummaryForOwner(ownerId);
  const activity = await service.listBudgetActivityForOwner(ownerId, 10);

  return (
    <>
      <section style={noticeStyle}>
        <p style={noticeTitleStyle}>Budget ledger</p>
        <p style={noticeCopyStyle}>
          Policy allowance is separate from wallet balance. Committed spend remains committed once payment is submitted.
        </p>
      </section>

      <section style={summaryPanelStyle} aria-label="Current daily budget summary">
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Summary</p>
            <h2 style={sectionTitleStyle}>Current policy budgets</h2>
          </div>
        </div>

        <div style={totalsGridStyle}>
          <Metric label="Committed" value={formatUSDC(Number(summary.totals.committedUSDC))} />
          <Metric label="Reserved" value={formatUSDC(Number(summary.totals.reservedUSDC))} />
          <Metric label="Available" value={formatUSDC(Number(summary.totals.availableUSDC))} />
          <Metric label="Active reservations" value={String(summary.totals.activeReservations)} />
        </div>
      </section>

      <section style={summaryPanelStyle} aria-label="Policy budget cards">
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Policies</p>
            <h2 style={sectionTitleStyle}>Policy budget cards</h2>
          </div>
        </div>

        {summary.policies.length > 0 ? (
          <div style={policyGridStyle}>
            {summary.policies.map((bucket) => (
              <article key={bucket.bucketId ?? `${bucket.policyId}-${bucket.periodStart}`} style={policyCardStyle}>
                <div style={policyCardHeaderStyle}>
                  <div>
                    <p style={policyCardTitleStyle}>
                      {bucket.policyName} {bucket.policyVersion ? `v${bucket.policyVersion}` : ""}
                    </p>
                    <p style={policyCardMetaStyle}>
                      {bucket.status === "ARCHIVED" ? "Archived policy" : "Active policy"} · {bucket.periodType}
                    </p>
                  </div>
                  <span style={policyCardPillStyle}>{bucket.activeReservationCount} active</span>
                </div>

                <div style={policyCardGridStyle}>
                  <Metric label="Daily limit" value={formatUSDC(Number(bucket.limitUSDC))} />
                  <Metric label="Committed" value={formatUSDC(Number(bucket.committedUSDC))} />
                  <Metric label="Reserved" value={formatUSDC(Number(bucket.reservedUSDC))} />
                  <Metric label="Available" value={formatUSDC(Number(bucket.availableUSDC))} />
                  <Metric
                    label="Reset window"
                    value={`${formatDateTime(bucket.periodStart)} to ${formatDateTime(bucket.periodEnd)}`}
                    title={`${bucket.periodStart} - ${bucket.periodEnd}`}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved policies yet"
            copy="Create a reusable policy or start from a template."
            actionHref="/agent/policies"
            actionLabel="View policies"
          />
        )}
      </section>

      <section style={summaryPanelStyle} aria-label="Recent ledger activity">
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Activity</p>
            <h2 style={sectionTitleStyle}>Recent ledger activity</h2>
          </div>
        </div>

        {activity.entries.length > 0 ? (
          <div style={activityListStyle}>
            {activity.entries.map((entry) => (
              <article key={entry.id} style={activityCardStyle}>
                <div style={activityCardHeaderStyle}>
                  <div>
                    <p style={activityTypeStyle}>{entry.type.replace(/_/g, " ").toLowerCase()}</p>
                    <h3 style={activityTitleStyle}>{entry.policyName}</h3>
                  </div>
                  <span style={activityAmountStyle}>{formatUSDC(Number(entry.amountUSDC))}</span>
                </div>

                <div style={activityMetaGridStyle}>
                  <Metric label="Period" value={`${formatDateTime(entry.periodStart)} - ${formatDateTime(entry.periodEnd)}`} />
                  <Metric label="Created" value={formatDateTime(entry.createdAt)} title={entry.createdAt} />
                  <Metric label="Execution" value={entry.executionId ?? "Unavailable"} />
                  <Metric label="Dedupe key" value={entry.dedupeKey} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No ledger activity yet"
            copy="Prepare a payment to create a reservation, then submit payment to commit spend."
            actionHref="/agent"
            actionLabel="Run Research Agent"
          />
        )}
      </section>
    </>
  );
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div style={metricStyle}>
      <p style={metricLabelStyle}>{label}</p>
      <p style={metricValueStyle} title={title}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({
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
    <div style={emptyStateStyle}>
      <h3 style={emptyTitleStyle}>{title}</h3>
      <p style={emptyCopyStyle}>{copy}</p>
      <Link href={actionHref} style={emptyActionStyle}>
        {actionLabel}
      </Link>
    </div>
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

const noticeStyle = {
  borderRadius: 20,
  border: "1px solid rgba(0,194,168,0.2)",
  background: "rgba(0,194,168,0.05)",
  padding: 18,
  display: "grid",
  gap: 8,
} as const;

const noticeTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const noticeCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;

const summaryPanelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const sectionTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const totalsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} as const;

const metricStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const metricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const metricValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const policyGridStyle = {
  display: "grid",
  gap: 12,
} as const;

const policyCardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  display: "grid",
  gap: 12,
} as const;

const policyCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const policyCardTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 16,
  lineHeight: 1.35,
} as const;

const policyCardMetaStyle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  lineHeight: 1.5,
} as const;

const policyCardPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  background: "rgba(0,194,168,0.08)",
  border: "1px solid rgba(0,194,168,0.25)",
  borderRadius: 999,
  padding: "6px 9px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const policyCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
} as const;

const activityListStyle = {
  display: "grid",
  gap: 12,
} as const;

const activityCardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  display: "grid",
  gap: 12,
} as const;

const activityCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const activityTypeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const activityTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 15,
  lineHeight: 1.35,
} as const;

const activityAmountStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  padding: "6px 9px",
  whiteSpace: "nowrap" as const,
} as const;

const activityMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
} as const;

const emptyStateStyle = {
  borderRadius: 16,
  border: "1px dashed var(--border)",
  background: "rgba(255,255,255,0.015)",
  padding: 18,
  display: "grid",
  gap: 10,
} as const;

const emptyTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 16,
  lineHeight: 1.35,
} as const;

const emptyCopyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;

const emptyActionStyle = {
  width: "fit-content",
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
