import { formatDateTime, formatUSDC } from "@/lib/ui";
import type { AgentPolicySummary } from "@/services/agent/AgentPolicyTypes";
import { AgentPolicyActions } from "./AgentPolicyActions";
import { AgentPolicyDefaultBadge } from "./AgentPolicyDefaultBadge";
import { AgentPolicyStatusBadge } from "./AgentPolicyStatusBadge";

export function AgentPolicyCard({
  policy,
}: {
  policy: AgentPolicySummary;
}) {
  return (
    <article style={cardStyle}>
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <div style={badgeRowStyle}>
            <AgentPolicyStatusBadge status={policy.status} />
            {policy.isDefault ? <AgentPolicyDefaultBadge /> : null}
          </div>
          <h3 style={titleStyle}>{policy.name}</h3>
          {policy.description ? <p style={copyStyle}>{policy.description}</p> : null}
        </div>

        <div style={metaColumnStyle}>
          <p style={versionStyle}>Version {policy.version}</p>
          <p style={metaStyle}>Updated {formatDateTime(policy.updatedAt)}</p>
        </div>
      </div>

      <dl style={gridStyle}>
        <Metric label="Daily budget" value={formatUSDC(Number(policy.dailyBudgetUSDC))} />
        <Metric label="Remaining budget" value={formatUSDC(Number(policy.remainingBudgetUSDC))} />
        <Metric label="Maximum purchase" value={formatUSDC(Number(policy.maxPurchaseUSDC))} />
        <Metric label="Minimum score" value={`${policy.minimumScore}/100`} />
        <Metric
          label="Approval"
          value={policy.manualApprovalRequired ? "Required" : "Disabled"}
        />
        <Metric
          label="Expiration"
          value={policy.expiresAt ? formatDateTime(policy.expiresAt) : "None"}
        />
      </dl>

      <AgentPolicyActions
        policyId={policy.id}
        status={policy.status}
        isDefault={policy.isDefault}
      />
    </article>
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

const cardStyle = {
  borderRadius: 18,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 18,
  display: "grid",
  gap: 16,
  minWidth: 0,
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const titleBlockStyle = {
  display: "grid",
  gap: 10,
  minWidth: 0,
} as const;

const badgeRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const titleStyle = {
  color: "var(--text-primary)",
  fontSize: 18,
  lineHeight: 1.35,
  overflowWrap: "anywhere" as const,
} as const;

const copyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const metaColumnStyle = {
  display: "grid",
  gap: 6,
  justifyItems: "end",
  textAlign: "right" as const,
} as const;

const versionStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const metaStyle = {
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
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
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const metricValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
} as const;

