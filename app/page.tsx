"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { WalletCopyButton } from "@/components/WalletCopyButton";
import {
  getFeaturedResources,
  getProtocolStats,
  getRecentActivity,
} from "@/lib/api";
import { arcExplorerTxUrl, formatUSDC, shortAddress } from "@/lib/ui";
import { useWallet } from "@/lib/ui/WalletContext";
import type {
  ActivityEventType,
  ProtocolStats,
  RecentActivityEntry,
  ResourceMeta,
  ResourceType,
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

export default function LandingPage() {
  const { address, connected, ready } = useWallet();
  const [stats, setStats] = useState<ProtocolStats>(EMPTY_STATS);
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProtocolStats(),
      getFeaturedResources(),
      getRecentActivity(),
    ])
      .then(([statsRes, resourcesRes, activityRes]) => {
        setStats(statsRes.stats);
        setResources(resourcesRes.resources);
        setActivity(activityRes.activity);
      })
      .catch(() => {
        setStats(EMPTY_STATS);
        setResources([]);
        setActivity([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const featured = useMemo(
    () =>
      resources.slice(0, 4).map((resource) => ({
        type: resource.type,
        name: resource.name,
        description: resource.description,
        image: resource.coverImage || getResourceImage(resource.type),
        href: `/access/${resource.id}`,
        priceUSDC: resource.priceUSDC,
        creatorWallet: resource.creatorWallet,
        creatorDisplayName: resource.creatorDisplayName,
      })),
    [resources],
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main>
        <section
          className="landing-hero"
          style={{
            minHeight: "calc(100vh - 56px)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <img
            className="landing-hero-media"
            src="/images/hero-visual.jpg"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              opacity: 0.42,
            }}
          />
          <div
            className="landing-hero-overlay"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, var(--bg) 0%, rgba(10,10,10,0.82) 38%, rgba(10,10,10,0.46) 100%)",
            }}
          />
          <div
            className="landing-hero-inner"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 1200,
              margin: "0 auto",
              padding: "72px 24px 96px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 18,
              }}
            >
              Built on Arc. Powered by Circle.
            </p>
            <h1
              style={{
                maxWidth: 760,
                fontSize: "clamp(42px, 7vw, 82px)",
                lineHeight: 1.02,
                fontWeight: 600,
                letterSpacing: 0,
                color: "var(--text-primary)",
                marginBottom: 22,
              }}
            >
              AccessMesh
            </h1>
            <p
              style={{
                maxWidth: 620,
                fontSize: "clamp(16px, 3.6vw, 18px)",
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                marginBottom: 30,
              }}
            >
              Unlock premium knowledge with USDC. Create valuable resources.
              Own your reputation on-chain.
            </p>
            <div className="landing-hero-actions" style={heroActionsStyle}>
              <Link href="/create" style={primaryButtonStyle}>
                Publish Resource
              </Link>
              <Link href="/explore" style={secondaryButtonStyle}>
                Explore Resources
              </Link>
              {!ready ? (
                <span style={connectWalletButtonStyle}>Restoring wallet...</span>
              ) : connected && address ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: 4,
                    overflow: "visible",
                  }}
                >
                  <Link href="/dashboard" style={connectedWalletButtonStyle}>
                    {shortAddress(address)}
                  </Link>
                  <WalletCopyButton
                    address={address}
                    buttonStyle={{
                      width: 38,
                      height: 38,
                      background: "rgba(0,0,0,0.12)",
                      color: "#000",
                      border: "0",
                      borderLeft: "1px solid rgba(0,0,0,0.18)",
                      borderRadius: 0,
                    }}
                  />
                </div>
              ) : (
                <Link href="/wallet" style={connectWalletButtonStyle}>
                  Connect Wallet
                </Link>
              )}
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionHeader
            eyebrow="Protocol stats"
            title="A public access layer for premium work"
          />
          <div style={statsGridStyle}>
            <StatCard
              label="Total Resources"
              value={loading ? "Loading..." : stats.totalResources}
            />
            <StatCard
              label="Total Unlocks"
              value={loading ? "Loading..." : stats.totalUnlocks}
            />
            <StatCard
              label="Total Volume"
              value={loading ? "Loading..." : formatUSDC(stats.totalUSDCVolume)}
            />
            <StatCard
              label="Total Creators"
              value={loading ? "Loading..." : stats.totalCreators}
            />
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionHeader
            eyebrow="Featured resources"
            title="Knowledge markets for operators"
            action={<Link href="/explore" style={inlineActionStyle}>View all</Link>}
          />
          {loading ? (
            <section style={emptyStateStyle}>
              <p style={{ color: "var(--text-muted)" }}>Loading featured resources...</p>
            </section>
          ) : featured.length > 0 ? (
            <div style={resourceGridStyle}>
              {featured.map((resource) => (
                <ResourcePreviewCard key={resource.name} resource={resource} />
              ))}
            </div>
          ) : (
            <section style={emptyStateStyle}>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                No resources have been published yet.
              </p>
            </section>
          )}
        </section>

        <section style={sectionStyle}>
          <SectionHeader
            eyebrow="Recent unlocks"
            title="Live public activity"
          />
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {loading ? (
              <p
                style={{
                  padding: 20,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                Loading activity...
              </p>
            ) : activity.length > 0 ? (
              activity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))
            ) : (
              <p
                style={{
                  padding: 20,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                No unlock activity yet. The feed will update when resources are
                unlocked on AccessMesh.
              </p>
            )}
          </div>
        </section>

        <section style={sectionStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            <TransparencyCard
              image="/images/feature-settlement.jpg"
              title="Payments settle on Arc"
              body="Access is granted after Arc USDC settlement is verified."
            />
            <TransparencyCard
              image="/images/feature-wallet.jpg"
              title="Wallet identity powered by Circle Modular Wallets"
              body="Passkeys unlock smart account identities without replacing your app flow."
            />
            <TransparencyCard
              image="/images/stat-events.jpg"
              title="Activity is verifiable"
              body="Unlocks, payments, and access events are recorded for public inspection."
            />
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "28px 24px",
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>Built on Arc. Powered by Circle.</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="https://x.com/AccessMesh" style={footerLinkStyle}>
              AccessMesh
            </a>
            <a href="https://x.com/arc" style={footerLinkStyle}>
              Arc
            </a>
            <a href="https://x.com/circle" style={footerLinkStyle}>
              Circle
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="section-header-row"
      style={{
        marginBottom: 18,
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </p>
        <h2
          style={{
            fontSize: 24,
            lineHeight: 1.25,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 18,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 12,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function ResourcePreviewCard({
  resource,
}: {
  resource: {
    type: ResourceType;
    name: string;
    description: string;
    image: string;
    href: string;
    priceUSDC?: number;
    creatorWallet?: string;
    creatorDisplayName?: string | null;
  };
}) {
  const creatorLabel =
    resource.creatorDisplayName?.trim() || shortAddress(resource.creatorWallet ?? "");

  return (
    <article
      style={{
        display: "block",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        color: "inherit",
      }}
    >
      <Link href={resource.href} style={{ display: "block", textDecoration: "none" }}>
        <img
          src={resource.image}
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: 150,
            objectFit: "cover",
            display: "block",
          }}
        />
      </Link>
      <div style={{ padding: 16 }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          {resource.type}
        </p>
        <Link
          href={resource.href}
          style={{
            display: "inline-block",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 8,
            textDecoration: "none",
          }}
        >
          {resource.name}
        </Link>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {resource.description}
        </p>
        {resource.creatorWallet && (
          <Link
            href={`/creator/${resource.creatorWallet}`}
            style={{
              display: "inline-block",
              marginTop: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            {creatorLabel}
            {resource.creatorDisplayName?.trim()
              ? ` ${shortAddress(resource.creatorWallet)}`
              : ""}
          </Link>
        )}
        {typeof resource.priceUSDC === "number" && (
          <p
            style={{
              marginTop: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--accent)",
            }}
          >
            {formatUSDC(resource.priceUSDC)}
          </p>
        )}
      </div>
    </article>
  );
}

function ActivityRow({ entry }: { entry: RecentActivityEntry }) {
  const activityMeta = activityMetaMap[entry.type];
  const creatorLabel =
    entry.creatorDisplayName?.trim() || shortAddress(entry.creatorWallet);
  const resourceTitle = entry.resourceTitle || entry.resourceName;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        padding: "14px 18px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--accent)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {activityMeta.label}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
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
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                {shortAddress(entry.wallet)}
              </span>{" "}
              {`${activityMeta.verb} "${resourceTitle}"`}
            </>
          ) : (
            <>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                {shortAddress(entry.wallet)}
              </span>{" "}
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
          <a
            href={arcExplorerTxUrl(entry.txHash)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            {shortAddress(entry.txHash)}
          </a>
        ) : null}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {new Date(entry.createdAt).toLocaleDateString()}
        </span>
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
    <Link
      href={`/creator/${wallet}`}
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
        textDecoration: "none",
      }}
    >
      {label}
      {displayName?.trim() ? ` ${shortAddress(wallet)}` : ""}
    </Link>
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

function TransparencyCard({
  image,
  title,
  body,
}: {
  image: string;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <img
        src={image}
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
      />
      <div style={{ padding: 18 }}>
        <h3 style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

function getResourceImage(type: ResourceType) {
  const map: Record<ResourceType, string> = {
    API: "/images/resource-api.jpg",
    CONTENT: "/images/resource-content.jpg",
    TOOL: "/images/resource-tool.jpg",
    DATASET: "/images/resource-dataset.jpg",
  };

  return map[type] ?? "/images/resource-content.jpg";
}

const sectionStyle = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "56px 24px",
} satisfies React.CSSProperties;

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
} satisfies React.CSSProperties;

const resourceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
} satisfies React.CSSProperties;

const emptyStateStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
} satisfies React.CSSProperties;

const heroActionsStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "11px 16px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
} satisfies React.CSSProperties;

const connectWalletButtonStyle = {
  ...primaryButtonStyle,
  background: "rgba(17,17,17,0.74)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
} satisfies React.CSSProperties;

const connectedWalletButtonStyle = {
  color: "#000",
  padding: "11px 14px 11px 16px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  background: "rgba(17,17,17,0.74)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "11px 16px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
} satisfies React.CSSProperties;

const inlineActionStyle = {
  color: "var(--accent)",
  fontSize: 13,
  textDecoration: "none",
  whiteSpace: "nowrap",
} satisfies React.CSSProperties;

const footerLinkStyle = {
  color: "var(--text-secondary)",
  textDecoration: "none",
} satisfies React.CSSProperties;
