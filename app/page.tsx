"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import {
  getFeaturedResources,
  getProtocolStats,
  getRecentActivity,
} from "@/lib/api";
import { formatUSDC, shortAddress } from "@/lib/ui";
import type {
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
};

const resourceFallbacks: Array<{
  type: ResourceType;
  name: string;
  description: string;
  image: string;
}> = [
  {
    type: "CONTENT",
    name: "AI Agent Blueprint",
    description: "A practical guide to designing revenue-ready AI workflows.",
    image: "/images/resource-content.jpg",
  },
  {
    type: "DATASET",
    name: "Research Signal Vault",
    description: "Curated market and protocol research for operators.",
    image: "/images/resource-dataset.jpg",
  },
  {
    type: "API",
    name: "Web3 Growth API",
    description: "Unlock high-intent growth signals for on-chain teams.",
    image: "/images/resource-api.jpg",
  },
  {
    type: "TOOL",
    name: "Developer Guide Kit",
    description: "Premium implementation notes for production builders.",
    image: "/images/resource-tool.jpg",
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState<ProtocolStats>(EMPTY_STATS);
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);

  useEffect(() => {
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
      });
  }, []);

  const featured = useMemo(
    () =>
      resources.length > 0
        ? resources.slice(0, 4).map((resource) => ({
            type: resource.type,
            name: resource.name,
            description: resource.description,
            image: getResourceImage(resource.type),
            href: `/access/${resource.id}`,
            priceUSDC: resource.priceUSDC,
          }))
        : resourceFallbacks.map((resource) => ({ ...resource, href: "/explore" })),
    [resources],
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main>
        <section
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
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, var(--bg) 0%, rgba(10,10,10,0.82) 38%, rgba(10,10,10,0.46) 100%)",
            }}
          />
          <div
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
                fontSize: 18,
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                marginBottom: 30,
              }}
            >
              Unlock premium knowledge with USDC. Create valuable resources.
              Own your reputation on-chain.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/wallet" style={primaryButtonStyle}>
                Connect Wallet
              </Link>
              <Link href="/explore" style={secondaryButtonStyle}>
                Explore Resources
              </Link>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionHeader
            eyebrow="Protocol stats"
            title="A public access layer for premium work"
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
            eyebrow="Featured resources"
            title="Knowledge markets for operators"
            action={<Link href="/explore" style={inlineActionStyle}>View all</Link>}
          />
          <div style={resourceGridStyle}>
            {featured.map((resource) => (
              <ResourcePreviewCard key={resource.name} resource={resource} />
            ))}
          </div>
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
            {activity.length > 0 ? (
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
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "end",
        gap: 16,
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
  };
}) {
  return (
    <Link
      href={resource.href}
      style={{
        display: "block",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
      }}
    >
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
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {resource.name}
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {resource.description}
        </p>
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
    </Link>
  );
}

function ActivityRow({ entry }: { entry: RecentActivityEntry }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
          {shortAddress(entry.payerWallet)}
        </span>{" "}
        unlocked "{entry.resourceName}"
      </p>
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
  );
}

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
