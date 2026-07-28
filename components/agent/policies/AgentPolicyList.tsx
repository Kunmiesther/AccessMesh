import { AgentPolicyCard } from "./AgentPolicyCard";
import { AgentPolicyEmptyState } from "./AgentPolicyEmptyState";
import type { AgentPolicySummary } from "@/services/agent/AgentPolicyTypes";

export function AgentPolicyList({
  policies,
}: {
  policies: AgentPolicySummary[];
}) {
  if (policies.length === 0) {
    return <AgentPolicyEmptyState />;
  }

  const activePolicies = policies.filter((policy) => policy.status === "ACTIVE");
  const archivedPolicies = policies.filter((policy) => policy.status === "ARCHIVED");

  return (
    <div style={stackStyle}>
      <section style={panelStyle} aria-label="Active policies">
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Active policies</p>
            <h2 style={titleStyle}>Ready for new runs</h2>
          </div>
        </div>

        {activePolicies.length > 0 ? (
          <div style={listStyle}>
            {activePolicies.map((policy) => (
              <AgentPolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <p style={emptyCopyStyle}>No active policies are available.</p>
        )}
      </section>

      <section style={panelStyle} aria-label="Archived policies">
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Archived policies</p>
            <h2 style={titleStyle}>Preserved for history</h2>
          </div>
        </div>

        {archivedPolicies.length > 0 ? (
          <div style={listStyle}>
            {archivedPolicies.map((policy) => (
              <AgentPolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <p style={emptyCopyStyle}>No archived policies yet.</p>
        )}
      </section>
    </div>
  );
}

const stackStyle = {
  display: "grid",
  gap: 20,
} as const;

const panelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const sectionHeaderStyle = {
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

const listStyle = {
  display: "grid",
  gap: 14,
} as const;

const emptyCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;

