"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getMarketplaceResources } from "@/lib/api";
import { formatUSDC, shortAddress } from "@/lib/ui";
import type { ResourceMeta, ResourceType, SortMode } from "@/types";

const defaultCategories: Array<ResourceType | "ALL"> = [
  "ALL",
  "CONTENT",
  "API",
  "TOOL",
  "DATASET",
];

export default function ExplorePage() {
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  useEffect(() => {
    let cancelled = false;

    getMarketplaceResources()
      .then((res) => {
        if (!cancelled) {
          setResources(res.resources);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResources([]);
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
  }, []);

  const categoryOptions = useMemo(() => {
    const discovered = Array.from(
      new Set(
        resources
          .map((resource) => resource.resourceCategory ?? resource.category)
          .filter((item): item is string => Boolean(item)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const preferred = defaultCategories.filter((item) =>
      item === "ALL" ? true : discovered.includes(item),
    );

    const extras = discovered.filter(
      (item) => !defaultCategories.includes(item as ResourceType | "ALL"),
    );

    return [...preferred, ...extras];
  }, [resources]);

  const visibleResources = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = resources.filter((resource) => {
      const resourceCategory = resource.resourceCategory ?? resource.category;
      const creatorLabel = resource.creatorDisplayName ?? resource.creatorWallet;
      const matchesCategory = category === "ALL" || resourceCategory === category;
      const matchesSearch =
        query.length === 0 ||
        [
          resource.title,
          resource.name,
          resource.description,
          resourceCategory,
          creatorLabel,
          resource.creatorWallet,
          ...(resource.tags ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "price-asc") {
        return a.priceUSDC - b.priceUSDC;
      }

      if (sortMode === "price-desc") {
        return b.priceUSDC - a.priceUSDC;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [category, resources, search, sortMode]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main className="page-main" style={{ maxWidth: 1240 }}>
        <header className="responsive-split-hero" style={heroStyle}>
          <div className="responsive-panel-padding" style={heroCopyStyle}>
            <p style={eyebrowStyle}>Explore</p>
            <h1 style={titleStyle}>Marketplace</h1>
            <p style={subtitleStyle}>
              Browse published resources from creators on AccessMesh.
            </p>
            <div style={heroActionRowStyle}>
              <Link href="/create" style={primaryActionButtonStyle}>
                + Create Resource
              </Link>
            </div>
          </div>
          <div className="hero-stats-mobile" style={heroStatsStyle}>
            <StatCard label="Published resources" value={resources.length} />
            <StatCard label="Visible results" value={visibleResources.length} />
          </div>
        </header>

        <section className="toolbar-mobile" style={toolbarStyle} aria-label="Marketplace filters">
          <label style={fieldStyle}>
            <span style={labelStyle}>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles, descriptions, creators, or tags"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={inputStyle}
            >
              <option value="ALL">All categories</option>
              {categoryOptions
                .filter((item) => item !== "ALL")
                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Sort</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              style={inputStyle}
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </section>

        {loading ? (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-muted)" }}>Loading published resources...</p>
          </section>
        ) : visibleResources.length > 0 ? (
          <div style={gridStyle}>
            {visibleResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <section style={emptyStateStyle}>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              No resources match the current marketplace filters.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function ResourceCard({ resource }: { resource: ResourceMeta }) {
  const resourceCategory = resource.resourceCategory ?? resource.category;
  const creatorDisplay =
    resource.creatorDisplayName?.trim().length
      ? resource.creatorDisplayName.trim()
      : null;
  const creatorWallet = shortAddress(resource.creatorWallet);
  const coverImageUrl = resource.coverImage ? encodeURI(resource.coverImage) : "";

  return (
    <article style={cardStyle}>
      <Link href={`/resource/${resource.id}`} style={coverLinkStyle}>
        <div
          style={{
            ...coverStyle,
            backgroundImage: resource.coverImage
              ? `linear-gradient(180deg, rgba(6, 8, 10, 0.08), rgba(6, 8, 10, 0.68)), url("${coverImageUrl}")`
              : "linear-gradient(135deg, rgba(0, 194, 168, 0.22), rgba(255, 255, 255, 0.03))",
          }}
        >
          <span style={coverTagStyle}>{resourceCategory}</span>
        </div>
      </Link>

      <div style={cardBodyStyle}>
        <div style={topRowStyle}>
          <span style={categoryStyle}>{resourceCategory}</span>
          <span style={priceStyle}>{formatUSDC(resource.priceUSDC)}</span>
        </div>

        <Link href={`/resource/${resource.id}`} style={titleLinkStyle}>
          {resource.title || resource.name}
        </Link>
        <p style={descriptionStyle}>{resource.description}</p>

        <div style={footerGridStyle}>
          <div style={creatorStyle}>
            <p style={metaLabelStyle}>Creator</p>
            {creatorDisplay ? (
              <>
                <Link href={`/creator/${resource.creatorWallet}`} style={creatorLinkStyle}>
                  {creatorDisplay}
                </Link>
                <p style={creatorWalletStyle}>{creatorWallet}</p>
              </>
            ) : (
              <Link href={`/creator/${resource.creatorWallet}`} style={creatorLinkStyle}>
                {creatorWallet}
              </Link>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={metaLabelStyle}>Unlocks</p>
            <p style={metaValueStyle}>{resource.unlockCount}</p>
          </div>
        </div>

        <div style={cardActionRowStyle}>
          <Link href={`/resource/${resource.id}`} style={cardActionButtonStyle}>
            View resource
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={statCardStyle}>
      <p style={statLabelStyle}>{label}</p>
      <p style={statValueStyle}>{value}</p>
    </div>
  );
}

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(min(100%, 320px), 0.85fr)",
  gap: 18,
  alignItems: "stretch",
  marginBottom: 28,
} satisfies CSSProperties;

const heroCopyStyle = {
  background:
    "linear-gradient(135deg, rgba(0,194,168,0.08), rgba(255,255,255,0.02)), var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 28,
} satisfies CSSProperties;

const heroStatsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
} satisfies CSSProperties;

const heroActionRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 12,
} satisfies CSSProperties;

const titleStyle = {
  fontSize: "clamp(30px, 7vw, 36px)",
  lineHeight: 1.08,
  color: "var(--text-primary)",
  marginBottom: 12,
} satisfies CSSProperties;

const subtitleStyle = {
  fontSize: 15,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  maxWidth: 640,
} satisfies CSSProperties;

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 24,
} satisfies CSSProperties;

const fieldStyle = {
  display: "block",
  minWidth: 0,
} satisfies CSSProperties;

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 4,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
} satisfies CSSProperties;

const primaryActionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "10px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
} satisfies CSSProperties;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 18,
} satisfies CSSProperties;

const cardStyle = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  color: "inherit",
  overflow: "hidden",
  minHeight: 360,
  transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
} satisfies CSSProperties;

const coverLinkStyle = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
} satisfies CSSProperties;

const coverWrapStyle = {
  borderBottom: "1px solid var(--border-subtle)",
} satisfies CSSProperties;

const coverStyle = {
  position: "relative",
  height: 170,
  padding: 16,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
} satisfies CSSProperties;

const coverTagStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "#fff",
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "6px 10px",
  backdropFilter: "blur(8px)",
} satisfies CSSProperties;

const cardBodyStyle = {
  padding: 18,
} satisfies CSSProperties;

const topRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 12,
} satisfies CSSProperties;

const categoryStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} satisfies CSSProperties;

const priceStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const titleLinkStyle = {
  display: "inline-block",
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
  marginBottom: 10,
  minHeight: 48,
  textDecoration: "none",
} satisfies CSSProperties;

const descriptionStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.65,
  marginBottom: 18,
  display: "-webkit-box",
  WebkitLineClamp: 4,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minHeight: 86,
} satisfies CSSProperties;

const footerGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "end",
  borderTop: "1px solid var(--border-subtle)",
  paddingTop: 14,
} satisfies CSSProperties;

const creatorStyle = {
  minWidth: 0,
} satisfies CSSProperties;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 5,
} satisfies CSSProperties;

const creatorLinkStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--accent)",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  textDecoration: "none",
} satisfies CSSProperties;

const creatorWalletStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
} satisfies CSSProperties;

const metaValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
} satisfies CSSProperties;

const cardActionRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 16,
} satisfies CSSProperties;

const cardActionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
} satisfies CSSProperties;

const statCardStyle = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
} satisfies CSSProperties;

const statLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 12,
} satisfies CSSProperties;

const statValueStyle = {
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 600,
  color: "var(--text-primary)",
  wordBreak: "break-word",
} satisfies CSSProperties;

const emptyStateStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
} satisfies CSSProperties;
