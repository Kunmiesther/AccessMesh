"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { getFeaturedResources } from "@/lib/api";
import { formatUSDC } from "@/lib/ui";
import type { ResourceMeta, ResourceType } from "@/types";

export default function ExplorePage() {
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedResources()
      .then((res) => setResources(res.resources))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 24px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            Explore
          </p>
          <h1 style={{ fontSize: 28, color: "var(--text-primary)", marginBottom: 10 }}>
            Premium resources
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Discover resources that can be unlocked with Arc USDC.
          </p>
        </header>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading resources...</p>
        ) : resources.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {resources.map((resource) => (
              <Link
                key={resource.id}
                href={`/access/${resource.id}`}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <img
                  src={getResourceImage(resource.type)}
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
                  <h2
                    style={{
                      fontSize: 16,
                      color: "var(--text-primary)",
                      marginBottom: 8,
                    }}
                  >
                    {resource.name}
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                    }}
                  >
                    {resource.description}
                  </p>
                  <p
                    style={{
                      marginTop: 12,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--accent)",
                    }}
                  >
                    {formatUSDC(resource.priceUSDC ?? 0)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              No public resources are available yet.
            </p>
          </div>
        )}
      </main>
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
