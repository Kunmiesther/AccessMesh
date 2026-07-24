import type { RefObject } from "react";
import { formatUSDC } from "@/lib/ui";
import {
  buildCandidateSubtitle,
  formatAgentDate,
  getCandidateStatusLabel,
} from "./agentUi";
import type { AgentCandidateEvaluationView } from "./types";

export function CandidateComparison({
  candidates,
  selectedCandidateId,
  selectedCandidateRef,
}: {
  candidates: AgentCandidateEvaluationView[];
  selectedCandidateId: string | null;
  selectedCandidateRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section style={panelStyle} aria-label="Candidate comparison">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Comparison</p>
          <h2 style={titleStyle}>Compared resources</h2>
        </div>
      </div>

      {candidates.length > 0 ? (
        <div style={gridStyle}>
          {candidates.map((candidate) => {
            const isSelected = candidate.resource.id === selectedCandidateId;
            const badgeStyle = isSelected
              ? selectedBadgeStyle
              : candidate.budgetEligible
                ? eligibleBadgeStyle
                : ineligibleBadgeStyle;

            return (
              <div
                key={candidate.resource.id}
                ref={isSelected ? selectedCandidateRef : undefined}
                style={cardStyle(isSelected, candidate.budgetEligible)}
              >
                <div style={cardHeaderStyle}>
                  <div style={titleBlockStyle}>
                    <h3 style={resourceTitleStyle}>{candidate.resource.title}</h3>
                    <p style={resourceMetaStyle}>
                      {candidate.resource.resourceType} •{" "}
                      {buildCandidateSubtitle(candidate)}
                    </p>
                  </div>
                  <span style={badgeStyle}>{getCandidateStatusLabel(candidate)}</span>
                </div>

                <div style={metaGridStyle}>
                  <Meta label="Price" value={formatUSDC(candidate.resource.priceUSDC)} />
                  <Meta
                    label="Match score"
                    value={`${candidate.matchScore}/100`}
                  />
                  <Meta
                    label="Published"
                    value={formatAgentDate(candidate.resource.publishedAt)}
                  />
                  <Meta
                    label="Category"
                    value={candidate.resource.aiCategory ?? "Uncategorized"}
                  />
                </div>

                {candidate.matchedKeywords.length > 0 ? (
                  <div style={sectionStyle}>
                    <p style={labelStyle}>Matched keywords</p>
                    <div style={pillRowStyle}>
                      {candidate.matchedKeywords.map((keyword) => (
                        <span key={keyword} style={pillStyle}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={sectionStyle}>
                  <p style={labelStyle}>Evaluation reasons</p>
                  <ul style={listStyle}>
                    {candidate.reasons.map((reason) => (
                      <li key={reason} style={listItemStyle}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <p style={emptyCopyStyle}>
            No marketplace resources were returned for the current scan window.
          </p>
        </div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <p style={metaLabelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
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
  gridTemplateColumns: "1fr",
  gap: 12,
} as const;

const cardStyle = (isSelected: boolean, eligible: boolean) =>
  ({
    borderRadius: 16,
    border: isSelected
      ? "1px solid rgba(0,194,168,0.45)"
      : eligible
        ? "1px solid var(--border-subtle)"
        : "1px solid rgba(224,82,82,0.26)",
    background: isSelected
      ? "rgba(0,194,168,0.06)"
      : "rgba(255,255,255,0.02)",
    padding: 16,
    display: "grid",
    gap: 14,
    minWidth: 0,
  }) as const;

const cardHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const titleBlockStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
} as const;

const resourceTitleStyle = {
  fontSize: 16,
  lineHeight: 1.4,
  color: "var(--text-primary)",
  overflowWrap: "anywhere" as const,
} as const;

const resourceMetaStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.5,
} as const;

const selectedBadgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "#000",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 999,
  padding: "7px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const eligibleBadgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--success)",
  background: "rgba(76,175,125,0.08)",
  border: "1px solid rgba(76,175,125,0.25)",
  borderRadius: 999,
  padding: "7px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const ineligibleBadgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--error)",
  background: "rgba(224,82,82,0.08)",
  border: "1px solid rgba(224,82,82,0.24)",
  borderRadius: 999,
  padding: "7px 10px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
} as const;

const metaItemStyle = {
  borderRadius: 12,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 12,
  minWidth: 0,
} as const;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const metaValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const sectionStyle = {
  display: "grid",
  gap: 10,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
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

const emptyStateStyle = {
  borderRadius: 16,
  border: "1px dashed var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 18,
} as const;

const emptyCopyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;
