"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getMarketplaceResources } from "@/lib/api";
import { formatUSDC, shortAddress } from "@/lib/ui";
import type { ResourceMeta, ResourceType, SortMode } from "@/types";

const categories: Array<ResourceType | "ALL"> = [
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
  const [category, setCategory] = useState<ResourceType | "ALL">("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  useEffect(() => {
    getMarketplaceResources()
      .then((res) => setResources(res.resources))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = resources.filter((resource) => {
      const matchesCategory =
        category === "ALL" || resource.category === category || resource.type === category;
      const matchesSearch =
        query.length === 0 ||
        [
          resource.title,
          resource.name,
          resource.description,
          resource.category,
          resource.creatorWallet,
          ...resource.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "price-asc") return a.priceUSDC - b.priceUSDC;
      if (sortMode === "price-desc") return b.priceUSDC - a.priceUSDC;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [category, resources, search, sortMode]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 24px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Explore</p>
          <h1 style={{ fontSize: 28, color: "var(--text-primary)", marginBottom: 10 }}>
            Marketplace
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Browse published resources from AccessMesh creators.
          </p>
        </header>

        <section style={toolbarStyle} aria-label="Marketplace filters">
          <label style={fieldStyle}>
            <span style={labelStyle}>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, description, creator, or tag"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ResourceType | "ALL")}
              style={inputStyle}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All categories" : item}
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
          <p style={{ color: "var(--text-muted)" }}>Loading resources...</p>
        ) : visibleResources.length > 0 ? (
          <div style={gridStyle}>
            {visibleResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              No resources match the current marketplace filters.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ResourceCard({ resource }: { resource: ResourceMeta }) {
  return (
    <Link href={`/resource/${resource.id}`} style={cardStyle}>
      <div style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={categoryStyle}>{resource.category}</span>
          <span style={priceStyle}>{formatUSDC(resource.priceUSDC)}</span>
        </div>

        <h2
          style={{
            fontSize: 17,
            color: "var(--text-primary)",
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          {resource.title || resource.name}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {resource.description}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            alignItems: "end",
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 14,
          }}
        >
          <div>
            <p style={metaLabelStyle}>Creator</p>
            <p style={metaValueStyle}>{shortAddress(resource.creatorWallet)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={metaLabelStyle}>Unlocks</p>
            <p style={metaValueStyle}>{resource.unlockCount}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
} satisfies CSSProperties;

const toolbarStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
} satisfies CSSProperties;

const cardStyle = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "inherit",
  textDecoration: "none",
  minHeight: 230,
} satisfies CSSProperties;

const categoryStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
} satisfies CSSProperties;

const priceStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 5,
} satisfies CSSProperties;

const metaValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
} satisfies CSSProperties;

const emptyStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 24,
} satisfies CSSProperties;
