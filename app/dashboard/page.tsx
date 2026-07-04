"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getDashboard } from "@/lib/api";
import { arcExplorerTxUrl, formatDate, formatUSDC, shortAddress } from "@/lib/ui";
import { useWallet } from "@/lib/ui/WalletContext";
import type {
  ActivityEventType,
  BridgeActivityEntry,
  CreatorAnalytics,
  DashboardResponse,
  ProtocolStats,
  RecentActivityEntry,
} from "@/types";

const EMPTY_STATS: ProtocolStats = {
  totalResources: 0,
  totalUnlocks: 0,
  totalUSDCVolume: 0,
  totalCreators: 0,
  bridges: {
    totalBridgedVolume: 0,
    numberOfBridges: 0,
    successfulBridges: 0,
    failedBridges: 0,
  },
};

const EMPTY_ANALYTICS: CreatorAnalytics = {
  revenueEarned: 0,
  resourcesPublished: 0,
  totalUnlocks: 0,
  topResource: null,
  x402: {
    protectedRequests: 0,
    successfulAccesses: 0,
    failedAccesses: 0,
    conversionRate: 0,
  },
};

export default function DashboardPage() {
  const { address, connected, ready } = useWallet();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      setDashboard(null);
      setLoading(true);
      setError(null);
      return;
    }

    if (!connected || !address) {
      setDashboard(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getDashboard(address)
      .then((dashboardRes) => {
        if (!cancelled) {
          setDashboard(dashboardRes);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setDashboard(null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Dashboard data could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, connected, ready]);

  const stats = dashboard?.stats ?? EMPTY_STATS;
  const analytics = dashboard?.analytics ?? EMPTY_ANALYTICS;
  const conversionRate = useMemo(
    () => `${(analytics.x402.conversionRate * 100).toFixed(1)}%`,
    [analytics.x402.conversionRate],
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main className="page-main" style={{ maxWidth: 1200 }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Dashboard</p>
          <h1
            style={{
              fontSize: "clamp(28px, 6vw, 30px)",
              color: "var(--text-primary)",
              marginBottom: 10,
            }}
          >
            Protocol analytics
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Live protocol metrics, creator performance, and access history from stored AccessMesh data.
          </p>
        </header>

        {connected && address && (
          <section style={createCtaStyle}>
            <div>
              <p style={eyebrowStyle}>Publishing</p>
              <h2 style={createCtaTitleStyle}>Create Resource</h2>
              <p style={createCtaBodyStyle}>
                Publish a new article, file upload, or external link behind a USDC price.
              </p>
            </div>
            <Link href="/create" style={primaryButtonStyle}>
              Create Resource
            </Link>
          </section>
        )}

        {!ready ? (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-secondary)" }}>
              Restoring authenticated wallet...
            </p>
          </section>
        ) : !connected || !address ? (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Connect a wallet to view creator analytics and protocol performance.
            </p>
            <Link href="/wallet?next=/dashboard" style={primaryButtonStyle}>
              Connect Wallet
            </Link>
          </section>
        ) : loading ? (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-secondary)" }}>Loading dashboard data...</p>
          </section>
        ) : error ? (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{error}</p>
          </section>
        ) : dashboard ? (
          <>
            <section style={sectionStyle}>
              <SectionHeader eyebrow="Protocol stats" title="Protocol-wide activity" />
              <div style={statsGridStyle}>
                <StatCard label="Total Resources" value={stats.totalResources} />
                <StatCard label="Total Unlocks" value={stats.totalUnlocks} />
                <StatCard label="Total Volume" value={formatUSDC(stats.totalUSDCVolume)} />
                <StatCard label="Total Creators" value={stats.totalCreators} />
                <StatCard
                  label="Bridged Volume"
                  value={formatUSDC(stats.bridges.totalBridgedVolume)}
                />
                <StatCard
                  label="Bridge Count"
                  value={stats.bridges.numberOfBridges}
                />
                <StatCard
                  label="Successful Bridges"
                  value={stats.bridges.successfulBridges}
                />
                <StatCard
                  label="Failed Bridges"
                  value={stats.bridges.failedBridges}
                />
              </div>
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Creator analytics" title="Performance for the connected wallet" />
              <div style={creatorGridStyle}>
                <StatCard
                  label="Creator Revenue"
                  value={formatUSDC(analytics.revenueEarned)}
                />
                <StatCard
                  label="Created Resources"
                  value={analytics.resourcesPublished}
                />
                <StatCard label="Unlock Count" value={analytics.totalUnlocks} />
                <div style={topResourceStyle}>
                  <p style={metricLabelStyle}>Top Resource</p>
                  {analytics.topResource ? (
                    <>
                      <Link
                        href={`/resource/${analytics.topResource.id}`}
                        style={topResourceLinkStyle}
                      >
                        {analytics.topResource.title}
                      </Link>
                      <div style={topResourceMetaGridStyle}>
                        <div>
                          <p style={metaLabelStyle}>Revenue</p>
                          <p style={metaValueStyle}>
                            {formatUSDC(analytics.topResource.revenue)}
                          </p>
                        </div>
                        <div>
                          <p style={metaLabelStyle}>Unlocks</p>
                          <p style={metaValueStyle}>{analytics.topResource.unlockCount}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      No published resources yet.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Purchased resources" title="Newest purchases first" />
              {dashboard.purchasedResources.length > 0 ? (
                <div style={listStyle}>
                  {dashboard.purchasedResources.map((purchase) => (
                    <PurchaseRow key={purchase.id} purchase={purchase} />
                  ))}
                </div>
              ) : (
                <section style={emptyStateStyle}>
                  <p style={emptyFeedTextStyle}>No purchases recorded yet.</p>
                </section>
              )}
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Created resources" title="Newest publications first" />
              {dashboard.createdResources.length > 0 ? (
                <div style={resourceGridStyle}>
                  {dashboard.createdResources.map((resource) => (
                    <Link key={resource.id} href={`/resource/${resource.id}`} style={resourceCardStyle}>
                      <div
                        style={{
                          ...resourceCardCoverStyle,
                          backgroundImage: resource.coverImage
                            ? `linear-gradient(135deg, rgba(6, 8, 10, 0.2), rgba(6, 8, 10, 0.72)), url("${encodeURI(resource.coverImage)}")`
                            : undefined,
                        }}
                      >
                        <span style={resourceTypeStyle}>
                          {resource.resourceCategory ?? resource.category}
                        </span>
                        <span style={resourcePriceStyle}>{formatUSDC(resource.priceUSDC)}</span>
                      </div>
                      <div style={resourceCardBodyStyle}>
                        <h3 style={resourceCardTitleStyle}>{resource.title}</h3>
                        <p style={resourceCardDescriptionStyle}>{resource.description}</p>
                        <div className="resource-card-meta-mobile" style={resourceCardMetaStyle}>
                          <MetaBlock label="Revenue" value={formatUSDC(resource.revenue)} />
                          <MetaBlock label="Unlocks" value={resource.unlockCount} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <section style={emptyStateStyle}>
                  <p style={emptyFeedTextStyle}>No created resources yet.</p>
                </section>
              )}
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Payment history" title="Settled USDC transfers" />
              {dashboard.paymentHistory.length > 0 ? (
                <div style={listStyle}>
                  {dashboard.paymentHistory.map((payment) => (
                    <PurchaseRow key={payment.id} purchase={payment} showResourceLink={false} />
                  ))}
                </div>
              ) : (
                <section style={emptyStateStyle}>
                  <p style={emptyFeedTextStyle}>No payment history yet.</p>
                </section>
              )}
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Cross-chain activity" title="CCTP bridge history" />
              {dashboard.crossChainActivity.length > 0 ? (
                <div style={bridgeTableStyle}>
                  <div className="bridge-table-header-mobile" style={bridgeHeaderStyle}>
                    {["Route", "Amount", "Status", "Timestamp"].map((label) => (
                      <span key={label} style={bridgeHeaderCellStyle}>
                        {label}
                      </span>
                    ))}
                  </div>
                  {dashboard.crossChainActivity.map((entry) => (
                    <BridgeRow key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <section style={emptyStateStyle}>
                  <p style={emptyFeedTextStyle}>No cross-chain activity yet.</p>
                </section>
              )}
            </section>

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Protocol activity" title="Newest events first" />
              {dashboard.protocolActivity.length > 0 ? (
                <div style={feedStyle}>
                  {dashboard.protocolActivity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <section style={emptyStateStyle}>
                  <p style={emptyFeedTextStyle}>No activity recorded yet.</p>
                </section>
              )}
            </section>

            <section style={sectionStyle}>
              <div style={tripleGridStyle}>
                <ActivityPanel
                  eyebrow="Recent unlocks"
                  title="Newest unlocks first"
                  entries={dashboard.recentUnlocks}
                />
                <ActivityPanel
                  eyebrow="Recent publications"
                  title="Newest publications first"
                  entries={dashboard.recentPublications}
                />
                <section style={x402PanelStyle}>
                  <SectionHeader eyebrow="x402 analytics" title="Protected access conversion" />
                  <div style={statsGridStyle}>
                    <StatCard
                      label="Protected Requests"
                      value={analytics.x402.protectedRequests}
                    />
                    <StatCard
                      label="Successful Accesses"
                      value={analytics.x402.successfulAccesses}
                    />
                    <StatCard
                      label="Failed Accesses"
                      value={analytics.x402.failedAccesses}
                    />
                    <StatCard label="Conversion Rate" value={conversionRate} />
                  </div>
                </section>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2 style={{ fontSize: 22, lineHeight: 1.3, color: "var(--text-primary)" }}>
        {title}
      </h2>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={statCardStyle}>
      <p style={metricLabelStyle}>{label}</p>
      <p style={metricValueStyle}>{value}</p>
    </div>
  );
}

function MetaBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p style={metaLabelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
    </div>
  );
}

function PurchaseRow({
  purchase,
  showResourceLink = true,
}: {
  purchase: {
    id: string;
    resourceId: string;
    resourceTitle: string;
    creatorWallet: string;
    creatorDisplayName: string | null;
    amountUSDC: number;
    txHash: string;
    timestamp: string;
  };
  showResourceLink?: boolean;
}) {
  const creatorLabel =
    purchase.creatorDisplayName?.trim() || shortAddress(purchase.creatorWallet);

  return (
    <div className="purchase-row-mobile" style={purchaseRowStyle}>
      <div style={{ minWidth: 0 }}>
        <div style={purchaseTitleRowStyle}>
          <Link href={`/resource/${purchase.resourceId}`} style={purchaseTitleStyle}>
            {purchase.resourceTitle}
          </Link>
          {showResourceLink && (
            <Link href={`/creator/${purchase.creatorWallet}`} style={creatorLinkStyle}>
              {creatorLabel}
              {purchase.creatorDisplayName?.trim()
                ? ` ${shortAddress(purchase.creatorWallet)}`
                : ""}
            </Link>
          )}
        </div>
        <p style={purchaseMetaStyle}>
          {formatDate(purchase.timestamp)} · {formatUSDC(purchase.amountUSDC)}
        </p>
      </div>
      <a href={arcExplorerTxUrl(purchase.txHash)} target="_blank" rel="noreferrer" style={txLinkStyle}>
        {purchase.txHash}
      </a>
    </div>
  );
}

function BridgeRow({ entry }: { entry: BridgeActivityEntry }) {
  const txHash = entry.destinationTxHash ?? entry.sourceTxHash;

  return (
    <div className="bridge-table-row-mobile" style={bridgeRowStyle}>
      <div style={{ minWidth: 0 }}>
        <p style={bridgeRouteStyle}>
          {entry.sourceChain} to {entry.destinationChain}
        </p>
        <Link href={`/resource/${entry.resourceId}`} style={bridgeResourceStyle}>
          {entry.resourceTitle}
        </Link>
        {entry.errorMessage ? (
          <p style={bridgeErrorStyle}>{entry.errorMessage}</p>
        ) : null}
      </div>
      <span style={bridgeAmountStyle}>{formatUSDC(entry.amountUSDC)}</span>
      <span style={{ ...bridgeStatusStyle, color: getBridgeStatusColor(entry.status) }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: getBridgeStatusColor(entry.status),
            flexShrink: 0,
          }}
        />
        {normaliseBridgeStatus(entry.status)}
      </span>
      <div style={{ textAlign: "right" }}>
        {txHash ? (
          <a href={arcExplorerTxUrl(txHash)} target="_blank" rel="noreferrer" style={txLinkStyle}>
            {shortAddress(txHash)}
          </a>
        ) : null}
        <span style={timestampStyle}>{formatDate(entry.timestamp)}</span>
      </div>
    </div>
  );
}

function ActivityPanel({
  eyebrow,
  title,
  entries,
}: {
  eyebrow: string;
  title: string;
  entries: RecentActivityEntry[];
}) {
  return (
    <section style={x402PanelStyle}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div style={feedStyle}>
        {entries.length > 0 ? (
          entries.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
        ) : (
          <p style={emptyFeedTextStyle}>No activity recorded yet.</p>
        )}
      </div>
    </section>
  );
}

function ActivityRow({ entry }: { entry: RecentActivityEntry }) {
  const activityMeta = activityMetaMap[entry.type];
  const creatorLabel =
    entry.creatorDisplayName?.trim() || shortAddress(entry.creatorWallet);
  const resourceTitle = entry.resourceTitle || entry.resourceName;

  return (
    <div className="activity-row-mobile" style={activityRowStyle}>
      <div style={{ minWidth: 0 }}>
        <p style={activityTypeStyle}>{activityMeta.label}</p>
        <p style={activityTextStyle}>
          {entry.type === "RESOURCE_PUBLISHED" ? (
            <>
              <CreatorActivityLink
                wallet={entry.creatorWallet}
                label={creatorLabel}
                displayName={entry.creatorDisplayName}
              />{" "}
              {`published "${resourceTitle}"`}
            </>
          ) : entry.type === "BRIDGE_STARTED" ||
            entry.type === "BRIDGE_COMPLETED" ||
            entry.type === "BRIDGE_FAILED" ? (
            <>
              <span style={activityActorStyle}>{shortAddress(entry.wallet)}</span>{" "}
              {`${activityMeta.verb} "${resourceTitle}"`}
            </>
          ) : (
            <>
              <span style={activityActorStyle}>{shortAddress(entry.wallet)}</span>{" "}
              {`${activityMeta.verb} "${resourceTitle}" by `}
              <CreatorActivityLink
                wallet={entry.creatorWallet}
                label={creatorLabel}
                displayName={entry.creatorDisplayName}
              />
            </>
          )}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        {entry.txHash ? (
          <a href={arcExplorerTxUrl(entry.txHash)} target="_blank" rel="noreferrer" style={txLinkStyle}>
            {shortAddress(entry.txHash)}
          </a>
        ) : null}
        <span style={timestampStyle}>{new Date(entry.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function CreatorActivityLink({
  wallet,
  label,
  displayName,
}: {
  wallet: string;
  label: string;
  displayName: string | null;
}) {
  return (
    <Link href={`/creator/${wallet}`} style={activityCreatorLinkStyle}>
      {label}
      {displayName?.trim() ? ` ${shortAddress(wallet)}` : ""}
    </Link>
  );
}

const activityMetaMap: Record<ActivityEventType, { label: string; verb: string }> = {
  RESOURCE_PUBLISHED: {
    label: "Resource Published",
    verb: "published",
  },
  RESOURCE_UNLOCKED: {
    label: "Resource Unlocked",
    verb: "unlocked",
  },
  PROTECTED_RESOURCE_ACCESSED: {
    label: "Protected Resource Accessed",
    verb: "accessed",
  },
  BRIDGE_STARTED: {
    label: "Bridge Started",
    verb: "started bridging for",
  },
  BRIDGE_COMPLETED: {
    label: "Bridge Completed",
    verb: "completed bridge for",
  },
  BRIDGE_FAILED: {
    label: "Bridge Failed",
    verb: "failed bridge for",
  },
};

function getBridgeStatusColor(status: BridgeActivityEntry["status"]) {
  if (status === "COMPLETED") {
    return "var(--success)";
  }

  if (status === "FAILED") {
    return "var(--error)";
  }

  return "var(--accent)";
}

function normaliseBridgeStatus(status: BridgeActivityEntry["status"]) {
  return status.toLowerCase();
}

const sectionStyle = {
  marginBottom: 28,
} satisfies CSSProperties;

const createCtaStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  background:
    "linear-gradient(135deg, rgba(0,194,168,0.08), rgba(255,255,255,0.02)), var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 22,
  marginBottom: 28,
  flexWrap: "wrap",
} satisfies CSSProperties;

const createCtaTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
  marginBottom: 8,
} satisfies CSSProperties;

const createCtaBodyStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  maxWidth: 620,
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
} satisfies CSSProperties;

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
} satisfies CSSProperties;

const creatorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  alignItems: "stretch",
} satisfies CSSProperties;

const statCardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  minWidth: 0,
} satisfies CSSProperties;

const metricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 12,
} satisfies CSSProperties;

const metricValueStyle = {
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 600,
  color: "var(--text-primary)",
  wordBreak: "break-word",
} satisfies CSSProperties;

const topResourceStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  minWidth: 0,
} satisfies CSSProperties;

const topResourceLinkStyle = {
  display: "inline-block",
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: 16,
  textDecoration: "none",
  wordBreak: "break-word",
} satisfies CSSProperties;

const topResourceMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} satisfies CSSProperties;

const metaValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  color: "var(--text-secondary)",
  wordBreak: "break-word",
} satisfies CSSProperties;

const listStyle = {
  display: "grid",
  gap: 12,
} satisfies CSSProperties;

const purchaseRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "center",
  padding: "14px 18px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
} satisfies CSSProperties;

const purchaseTitleRowStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 5,
} satisfies CSSProperties;

const purchaseTitleStyle = {
  fontSize: 14,
  color: "var(--text-primary)",
  textDecoration: "none",
  fontWeight: 600,
  wordBreak: "break-word",
} satisfies CSSProperties;

const creatorLinkStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--accent)",
  textDecoration: "none",
  wordBreak: "break-word",
} satisfies CSSProperties;

const purchaseMetaStyle = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.5,
} satisfies CSSProperties;

const txLinkStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textDecoration: "none",
  wordBreak: "break-all",
  lineHeight: 1.5,
} satisfies CSSProperties;

const feedStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  overflow: "hidden",
} satisfies CSSProperties;

const bridgeTableStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  overflow: "hidden",
  overflowX: "auto",
} satisfies CSSProperties;

const bridgeHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) 140px 140px 180px",
  minWidth: 720,
  gap: 14,
  padding: "10px 18px",
  borderBottom: "1px solid var(--border)",
} satisfies CSSProperties;

const bridgeHeaderCellStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
} satisfies CSSProperties;

const bridgeRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) 140px 140px 180px",
  minWidth: 720,
  gap: 14,
  alignItems: "center",
  padding: "14px 18px",
  borderBottom: "1px solid var(--border-subtle)",
} satisfies CSSProperties;

const bridgeRouteStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  marginBottom: 5,
} satisfies CSSProperties;

const bridgeResourceStyle = {
  fontSize: 12,
  color: "var(--text-secondary)",
  textDecoration: "none",
  lineHeight: 1.5,
  wordBreak: "break-word",
} satisfies CSSProperties;

const bridgeAmountStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
} satisfies CSSProperties;

const bridgeStatusStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  gap: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
} satisfies CSSProperties;

const bridgeErrorStyle = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--error)",
  lineHeight: 1.5,
} satisfies CSSProperties;

const activityRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  padding: "14px 18px",
  borderBottom: "1px solid var(--border-subtle)",
} satisfies CSSProperties;

const activityTypeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} satisfies CSSProperties;

const activityTextStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  wordBreak: "break-word",
} satisfies CSSProperties;

const activityCreatorLinkStyle = {
  fontFamily: "var(--font-mono)",
  color: "var(--text-primary)",
  textDecoration: "none",
} satisfies CSSProperties;

const activityActorStyle = {
  fontFamily: "var(--font-mono)",
  color: "var(--text-primary)",
} satisfies CSSProperties;

const timestampStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const resourceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
  gap: 16,
} satisfies CSSProperties;

const resourceCardStyle = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
} satisfies CSSProperties;

const resourceCardCoverStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  padding: 16,
  minHeight: 120,
  background:
    "linear-gradient(135deg, rgba(0,194,168,0.18), rgba(255,255,255,0.02))",
  borderBottom: "1px solid var(--border-subtle)",
} satisfies CSSProperties;

const resourceCardBodyStyle = {
  padding: 16,
} satisfies CSSProperties;

const resourceCardTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
  marginBottom: 8,
} satisfies CSSProperties;

const resourceCardDescriptionStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: 16,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} satisfies CSSProperties;

const resourceCardMetaStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  borderTop: "1px solid var(--border-subtle)",
  paddingTop: 14,
} satisfies CSSProperties;

const resourceTypeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const resourcePriceStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const tripleGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 16,
} satisfies CSSProperties;

const x402PanelStyle = {
  minWidth: 0,
} satisfies CSSProperties;

const emptyStateStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
} satisfies CSSProperties;

const emptyFeedTextStyle = {
  padding: 20,
  color: "var(--text-muted)",
  lineHeight: 1.6,
} satisfies CSSProperties;

const primaryButtonStyle = {
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "11px 16px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
} satisfies CSSProperties;
