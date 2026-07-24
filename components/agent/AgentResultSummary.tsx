import { formatUSDC } from "@/lib/ui";
import { deriveSkipReasons, formatBuyAgentResult, formatSkipAgentResult } from "./agentUi";
import type { AgentBudgetPolicy } from "@/services/agent/types";
import type { AgentRuntimeResultView } from "./types";

export function AgentResultSummary({
  result,
  policy,
  onReviewPurchase,
}: {
  result: AgentRuntimeResultView;
  policy: AgentBudgetPolicy;
  onReviewPurchase?: () => void;
}) {
  const isBuy = result.decision === "BUY";
  const summary = isBuy
    ? formatBuyAgentResult(result, policy)
    : formatSkipAgentResult(result, policy);
  const selectedResource = result.selectedResource;

  return (
    <section
      style={isBuy ? buyPanelStyle : skipPanelStyle}
      aria-live="polite"
      aria-label="Agent recommendation summary"
    >
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>
            {isBuy ? "Recommended purchase" : "No purchase recommended"}
          </p>
          <h2 style={titleStyle}>{summary.title}</h2>
        </div>
        <span style={decisionPillStyle(isBuy)}>
          {result.decision === "BUY" ? "BUY" : "SKIP"}
        </span>
      </div>

      {isBuy && selectedResource ? (
        <div style={bodyGridStyle}>
          <div style={resourceBlockStyle}>
            <p style={fieldLabelStyle}>Selected resource</p>
            <h3 style={resourceTitleStyle}>{selectedResource.title}</h3>
            <p style={resourceMetaStyle}>
              {selectedResource.resourceType} • {selectedResource.aiCollection || selectedResource.aiPlacement || "Uncategorized"}
            </p>
          </div>

          <div style={summaryStatsStyle}>
            <SummaryStat label="Price" value={formatUSDC(selectedResource.priceUSDC)} />
            <SummaryStat label="Match score" value={`${result.selectedEvaluation?.matchScore ?? 0}/100`} />
            <SummaryStat
              label="Remaining budget"
              value={formatUSDC(summary.remainingBudgetUSDC)}
            />
          </div>

          {isBuy && summary.matchedKeywords.length > 0 ? (
            <div style={sectionStyle}>
              <p style={fieldLabelStyle}>Matched keywords</p>
              <div style={pillRowStyle}>
                {summary.matchedKeywords.map((keyword) => (
                  <span key={keyword} style={pillStyle}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div style={sectionStyle}>
            <p style={fieldLabelStyle}>Reasons</p>
            <ul style={listStyle}>
              {summary.reasons.map((reason) => (
                <li key={reason} style={listItemStyle}>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div style={footerStyle}>
            <p style={helperStyle}>
              This is a recommendation only. No payment has been executed.
            </p>
            <button type="button" onClick={onReviewPurchase} style={buttonStyle}>
              Review purchase
            </button>
          </div>
        </div>
      ) : (
        <div style={bodyGridStyle}>
          <p style={helperStyle}>
            {deriveSkipReasons(result, policy).join(" ")}
          </p>
          <div style={summaryStatsStyle}>
            <SummaryStat label="Selected price" value={formatUSDC(0)} />
            <SummaryStat
              label="Remaining budget"
              value={formatUSDC(summary.remainingBudgetUSDC)}
            />
            <SummaryStat
              label="Match threshold"
              value={`${Math.round(policy.minimumMatchScore)}/100`}
            />
          </div>

          <div style={sectionStyle}>
            <p style={fieldLabelStyle}>Reasons</p>
            <ul style={listStyle}>
              {summary.reasons.map((reason) => (
                <li key={reason} style={listItemStyle}>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <p style={statLabelStyle}>{label}</p>
      <p style={statValueStyle}>{value}</p>
    </div>
  );
}

const buyPanelStyle = {
  background:
    "linear-gradient(180deg, rgba(0,194,168,0.14) 0%, rgba(13, 15, 17, 0.98) 40%, rgba(13, 15, 17, 0.98) 100%)",
  border: "1px solid rgba(0, 194, 168, 0.35)",
  borderRadius: 18,
  padding: 22,
  display: "grid",
  gap: 16,
} as const;

const skipPanelStyle = {
  background: "rgba(13, 15, 17, 0.98)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 22,
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
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const decisionPillStyle = (isBuy: boolean) =>
  ({
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: isBuy ? "#000" : "var(--text-secondary)",
    background: isBuy ? "var(--accent)" : "rgba(255,255,255,0.03)",
    border: isBuy ? "1px solid var(--accent)" : "1px solid var(--border)",
    borderRadius: 999,
    padding: "8px 10px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
  }) as const;

const bodyGridStyle = {
  display: "grid",
  gap: 16,
  minWidth: 0,
} as const;

const resourceBlockStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
} as const;

const fieldLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const resourceTitleStyle = {
  fontSize: 18,
  lineHeight: 1.35,
  color: "var(--text-primary)",
  marginBottom: 8,
  overflowWrap: "anywhere" as const,
} as const;

const resourceMetaStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const summaryStatsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
} as const;

const statStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
} as const;

const statLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 10,
} as const;

const statValueStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.5,
} as const;

const sectionStyle = {
  display: "grid",
  gap: 10,
} as const;

const pillRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const pillStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "7px 10px",
  fontSize: 12,
  lineHeight: 1.4,
} as const;

const listStyle = {
  listStyle: "disc",
  marginLeft: 18,
  display: "grid",
  gap: 8,
} as const;

const listItemStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const helperStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;

const footerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
} as const;

const buttonStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
} as const;
