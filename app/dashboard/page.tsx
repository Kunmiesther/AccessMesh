"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getDashboard, getRecentActivity } from "@/lib/api";
import { formatUSDC, shortAddress } from "@/lib/ui";
import { useWallet } from "@/lib/ui/WalletContext";
import type {
  ActivityEventType,
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
  const { address, connected } = useWallet();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !address) {
      setDashboard(null);
      setActivity([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([getDashboard(address), getRecentActivity()])
      .then(([dashboardRes, activityRes]) => {
        if (cancelled) {
          return;
        }

        setDashboard(dashboardRes);
        setActivity(activityRes.activity);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }

        setDashboard(null);
        setActivity([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Dashboard data could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, connected]);

  const stats = dashboard?.stats ?? EMPTY_STATS;
  const analytics = dashboard?.analytics ?? EMPTY_ANALYTICS;
  const conversionRate = useMemo(
    () => `${(analytics.x402.conversionRate * 100).toFixed(1)}%`,
    [analytics.x402.conversionRate],
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 24px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Dashboard</p>
          <h1 style={{ fontSize: 30, color: "var(--text-primary)", marginBottom: 10 }}>
            Protocol analytics
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Live protocol metrics and creator performance from stored AccessMesh data.
          </p>
        </header>

        {!connected || !address ? (
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
        ) : (
          <>
            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Protocol stats"
                title="Protocol-wide activity"
              />
              <div style={statsGridStyle}>
                <StatCard label="Total Resources" value={stats.totalResources} />
                <StatCard label="Total Unlocks" value={stats.totalUnlocks} />
                <StatCard
                  label="Total USDC Volume"
                  value={formatUSDC(stats.totalUSDCVolume)}
                />
                <StatCard label="Total Creators" value={stats.totalCreators} />
              </div>
            </section>

            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Creator analytics"
                title="Performance for the connected wallet"
              />
              <div style={creatorGridStyle}>
                <StatCard
                  label="Revenue Earned"
                  value={formatUSDC(analytics.revenueEarned)}
                />
                <StatCard
                  label="Resources Published"
                  value={analytics.resourcesPublished}
                />
                <StatCard label="Total Unlocks" value={analytics.totalUnlocks} />
                <div style={topResourceStyle}>
                  <p style={metricLabelStyle}>Top Performing Resource</p>
                  {analytics.topResource ? (
                    <>
                      <h2 style={topResourceTitleStyle}>
                        {analytics.topResource.title}
                      </h2>
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

            <section style={sectionStyle}>
              <SectionHeader eyebrow="Activity feed" title="Newest events first" />
              <div style={feedStyle}>
                {activity.length > 0 ? (
                  activity.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
                ) : (
                  <p style={emptyFeedTextStyle}>No activity recorded yet.</p>
                )}
              </div>
            </section>
          </>
        )}
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

function ActivityRow({ entry }: { entry: RecentActivityEntry }) {
  const activityMeta = activityMetaMap[entry.type];

  return (
    <div style={activityRowStyle}>
      <div style={{ minWidth: 0 }}>
        <p style={activityTypeStyle}>{activityMeta.label}</p>
        <p style={activityTextStyle}>
          <span style={walletStyle}>{shortAddress(entry.wallet)}</span>{" "}
          {activityMeta.verb} "{entry.resourceTitle || entry.resourceName}"
        </p>
      </div>
      <span style={timestampStyle}>{new Date(entry.createdAt).toLocaleDateString()}</span>
    </div>
  );
}

const activityMetaMap: Record<
  ActivityEventType,
  { label: string; verb: string }
> = {
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
};

const sectionStyle = {
  marginBottom: 28,
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

const topResourceTitleStyle = {
  fontSize: 18,
  lineHeight: 1.35,
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: 16,
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

const feedStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  overflow: "hidden",
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

const walletStyle = {
  fontFamily: "var(--font-mono)",
  color: "var(--text-primary)",
} satisfies CSSProperties;

const timestampStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 24,
} satisfies CSSProperties;

const emptyFeedTextStyle = {
  padding: 20,
  color: "var(--text-muted)",
  lineHeight: 1.6,
} satisfies CSSProperties;

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "11px 16px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  width: "fit-content",
} satisfies CSSProperties;
