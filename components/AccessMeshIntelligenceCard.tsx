import Link from "next/link";
import type { CSSProperties } from "react";
import { formatUSDC, shortAddress } from "@/lib/ui";
import type { ResourceDetail } from "@/types";

export function AccessMeshIntelligenceCard({
  resource,
}: {
  resource: ResourceDetail;
}) {
  const hasMetadata =
    Boolean(resource.aiSummary) ||
    Boolean(resource.aiAudience) ||
    Boolean(resource.aiCollection) ||
    Boolean(resource.aiTopics?.length) ||
    Boolean(resource.aiRelatedResources?.length);

  if (!hasMetadata) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>AccessMesh Intelligence</p>
          <h2 style={titleStyle}>Discovery context for this resource</h2>
        </div>
        {resource.aiPlacement ? (
          <span style={placementBadgeStyle}>{resource.aiPlacement}</span>
        ) : null}
      </div>

      <p style={introStyle}>
        AccessMesh Intelligence analyzes published resources and organizes them
        into discovery collections so buyers and agents can find relevant
        premium knowledge faster.
      </p>

      <div style={contentGridStyle}>
        {resource.aiSummary ? (
          <InfoBlock label="Summary" value={resource.aiSummary} />
        ) : null}
        {resource.aiAudience ? (
          <InfoBlock label="Audience" value={resource.aiAudience} />
        ) : null}
        {resource.aiCollection ? (
          <InfoBlock label="Collection" value={resource.aiCollection} />
        ) : null}
      </div>

      {resource.aiTopics && resource.aiTopics.length > 0 ? (
        <div style={sectionStyle}>
          <p style={labelStyle}>Topics</p>
          <div style={pillRowStyle}>
            {resource.aiTopics.map((topic) => (
              <span key={topic} style={pillStyle}>
                {topic}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {resource.aiRelatedResources && resource.aiRelatedResources.length > 0 ? (
        <div style={sectionStyle}>
          <p style={labelStyle}>Related resources</p>
          <div style={relatedGridStyle}>
            {resource.aiRelatedResources.map((related) => (
              <Link
                key={related.id}
                href={`/resource/${related.id}`}
                style={relatedCardStyle}
              >
                <span style={relatedTitleStyle}>{related.title}</span>
                <span style={relatedMetaStyle}>
                  {related.creatorDisplayName?.trim() ||
                    shortAddress(related.creatorWallet)}
                </span>
                <span style={relatedPriceStyle}>{formatUSDC(related.priceUSDC)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={bodyStyle}>{value}</p>
    </div>
  );
}

const panelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  display: "grid",
  gap: 16,
} satisfies CSSProperties;

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} satisfies CSSProperties;

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} satisfies CSSProperties;

const placementBadgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  borderRadius: 999,
  padding: "7px 10px",
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
} satisfies CSSProperties;

const introStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
} satisfies CSSProperties;

const contentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const infoBlockStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: 14,
  background: "#0d0f11",
} satisfies CSSProperties;

const sectionStyle = {
  display: "grid",
  gap: 10,
} satisfies CSSProperties;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} satisfies CSSProperties;

const bodyStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
} satisfies CSSProperties;

const pillRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} satisfies CSSProperties;

const pillStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "8px 10px",
  fontSize: 12,
  lineHeight: 1.4,
} satisfies CSSProperties;

const relatedGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
} satisfies CSSProperties;

const relatedCardStyle = {
  display: "grid",
  gap: 6,
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  textDecoration: "none",
} satisfies CSSProperties;

const relatedTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.45,
} satisfies CSSProperties;

const relatedMetaStyle = {
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} satisfies CSSProperties;

const relatedPriceStyle = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
} satisfies CSSProperties;
