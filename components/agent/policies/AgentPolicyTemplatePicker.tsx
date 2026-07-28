import Link from "next/link";
import { POLICY_TEMPLATE_PRESENTATION } from "./policyPresentation";

export function AgentPolicyTemplatePicker() {
  return (
    <section style={panelStyle} aria-label="Policy templates">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Templates</p>
          <h2 style={titleStyle}>Start from a template</h2>
        </div>
      </div>

      <div style={gridStyle}>
        {Object.values(POLICY_TEMPLATE_PRESENTATION).map((template) => (
          <article key={template.id} style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h3 style={cardTitleStyle}>{template.name}</h3>
                <p style={cardCopyStyle}>{template.description}</p>
              </div>
              <Link href={`/agent/policies/new?template=${template.id}`} style={cardLinkStyle}>
                Use template
              </Link>
            </div>

            <dl style={listStyle}>
              <Metric label="Daily budget" value={`${template.dailyBudgetUSDC} USDC`} />
              <Metric label="Remaining budget" value={`${template.remainingBudgetUSDC} USDC`} />
              <Metric label="Maximum purchase" value={`${template.maxPurchaseUSDC} USDC`} />
              <Metric label="Minimum score" value={`${template.minimumScore}/100`} />
              <Metric label="Approval" value="Required" />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <dt style={metricLabelStyle}>{label}</dt>
      <dd style={metricValueStyle}>{value}</dd>
    </div>
  );
}

const panelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
} as const;

const cardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 14,
} as const;

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const cardTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 16,
  lineHeight: 1.35,
  marginBottom: 8,
} as const;

const cardCopyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const cardLinkStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "10px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
} as const;

const listStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
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
  fontSize: 13,
  lineHeight: 1.5,
} as const;

