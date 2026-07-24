import { formatUSDC } from "@/lib/ui";

export function AgentBudgetCard({
  startingBudgetUSDC,
  maximumPurchaseUSDC,
  selectedPriceUSDC,
  minimumMatchScore,
}: {
  startingBudgetUSDC: number;
  maximumPurchaseUSDC: number;
  selectedPriceUSDC: number;
  minimumMatchScore: number;
}) {
  const remainingBudgetUSDC = Math.max(0, startingBudgetUSDC - selectedPriceUSDC);

  return (
    <section style={panelStyle} aria-label="Budget overview">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Budget card</p>
          <h2 style={titleStyle}>Recommendation policy</h2>
        </div>
      </div>

      <dl style={gridStyle}>
        <Metric label="Starting budget" value={formatUSDC(startingBudgetUSDC)} />
        <Metric label="Maximum purchase" value={formatUSDC(maximumPurchaseUSDC)} />
        <Metric label="Selected price" value={formatUSDC(selectedPriceUSDC)} />
        <Metric
          label="Estimated remaining"
          value={formatUSDC(remainingBudgetUSDC)}
        />
        <Metric
          label="Match threshold"
          value={`${Math.round(minimumMatchScore)} / 100`}
        />
      </dl>
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
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
  display: "grid",
  gap: 16,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
} as const;

const metricStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const metricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: 10,
} as const;

const metricValueStyle = {
  color: "var(--text-primary)",
  fontSize: 15,
  lineHeight: 1.5,
  wordBreak: "break-word" as const,
} as const;
