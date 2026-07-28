import Link from "next/link";
import { formatUSDCAmount } from "./formatters";
import type { AnalyticsResourceItem } from "@/services/agent/AgentExecutionAnalytics";

export function AgentTopResources({
  resources,
}: {
  resources: AnalyticsResourceItem[];
}) {
  return (
    <section style={panelStyle} aria-label="Top resources">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Resources</p>
          <h2 style={titleStyle}>Top recurring resources</h2>
        </div>
      </div>

      {resources.length > 0 ? (
        <div style={gridStyle}>
          {resources.map((resource) => (
            <article key={`${resource.resourceId ?? resource.title}`} style={cardStyle}>
              <div style={titleRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={resourceTitleStyle}>{resource.title}</h3>
                  <p style={resourceMetaStyle}>
                    {resource.category ?? "Uncategorized"}
                    {resource.collection ? ` · ${resource.collection}` : ""}
                  </p>
                </div>
                {resource.resourceId ? (
                  <Link href={`/resource/${resource.resourceId}`} style={linkStyle}>
                    Open
                  </Link>
                ) : null}
              </div>

              <div style={metricsGridStyle}>
                <Metric label="Recommendations" value={String(resource.recommendations)} />
                <Metric label="Completed" value={String(resource.completedPurchases)} />
                <Metric label="Completed spend" value={formatUSDCAmount(resource.completedSpendUSDC)} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p style={emptyStyle}>No resource snapshots were available for this period.</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <p style={metricLabelStyle}>{label}</p>
      <p style={metricValueStyle}>{value}</p>
    </div>
  );
}

const panelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
  display: "grid",
  gap: 16,
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const gridStyle = {
  display: "grid",
  gap: 12,
} as const;

const cardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  display: "grid",
  gap: 12,
  minWidth: 0,
} as const;

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const resourceTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 16,
  lineHeight: 1.35,
  overflowWrap: "anywhere" as const,
} as const;

const resourceMetaStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 6,
} as const;

const linkStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "8px 10px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  whiteSpace: "nowrap" as const,
} as const;

const metricsGridStyle = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
} as const;

const metricStyle = {
  borderRadius: 12,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 12,
  minWidth: 0,
} as const;

const metricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const metricValueStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const emptyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;

