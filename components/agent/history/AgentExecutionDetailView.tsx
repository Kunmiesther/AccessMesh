import Link from "next/link";
import type { ReactNode } from "react";
import {
  abbreviateIdentifier,
  formatDateTime,
  formatUSDC,
} from "@/lib/ui";
import type { AgentExecutionDetailView } from "@/services/agent/AgentExecutionTypes";
import { AgentDecisionBadge } from "./AgentDecisionBadge";
import { AgentExecutionStatusBadge } from "./AgentExecutionStatusBadge";
import { AgentExecutionTimeline } from "./AgentExecutionTimeline";
import { CopyValueButton } from "./CopyValueButton";
import { getExecutionStatusPresentation } from "./executionPresentation";
import { AgentApprovalDecisionPanel } from "../approvals/AgentApprovalDecisionPanel";

export function AgentExecutionDetailPanel({
  execution,
}: {
  execution: AgentExecutionDetailView;
}) {
  const statusPresentation = getExecutionStatusPresentation(execution.status);
  const isBuy = execution.decision === "BUY";
  const purchase = execution.purchase;
  const selectedResource = execution.selectedResource;
  const selectedEvaluation = execution.selectedEvaluation;
  const budgetRemainingAfterPurchase =
    execution.policy && purchase?.amountUSDC !== null && purchase?.amountUSDC !== undefined
      ? Math.max(0, execution.policy.remainingBudgetUSDC - purchase.amountUSDC)
      : null;
  const bestCandidate =
    execution.candidates.length > 0
      ? [...execution.candidates].sort((left, right) => right.matchScore - left.matchScore)[0]
      : null;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={titleBlockStyle}>
          <p style={eyebrowStyle}>Execution detail</p>
          <h1 style={titleStyle}>Agent execution {execution.id}</h1>
          <p style={leadStyle}>{statusPresentation.description}</p>
        </div>

        <div style={headerActionsStyle}>
          <Link href="/agent/history" style={secondaryLinkStyle}>
            Back to history
          </Link>
          <Link href="/agent/inbox" style={secondaryLinkStyle}>
            View inbox
          </Link>
          <Link href="/agent/notifications" style={secondaryLinkStyle}>
            View notifications
          </Link>
          <Link href="/agent/analytics" style={secondaryLinkStyle}>
            View analytics
          </Link>
          <Link href="/agent/policies" style={secondaryLinkStyle}>
            View policies
          </Link>
          <Link href="/agent" style={primaryLinkStyle}>
            Open Research Agent
          </Link>
        </div>
      </header>

      <section style={summaryPanelStyle} aria-label="Execution summary">
        <SummaryCard label="Status" value={<AgentExecutionStatusBadge status={execution.status} />} />
        <SummaryCard label="Decision" value={<AgentDecisionBadge decision={execution.decision} />} />
        <SummaryCard
          label="Execution ID"
          value={
            <InlineCopy
              value={execution.id}
              label={abbreviateIdentifier(execution.id, { start: 8, end: 6 })}
            />
          }
        />
        <SummaryCard label="Started" value={formatDateTime(execution.startedAt)} title={execution.startedAt} />
        <SummaryCard label="Updated" value={formatDateTime(execution.updatedAt)} title={execution.updatedAt} />
        <SummaryCard
          label="Completed"
          value={execution.completedAt ? formatDateTime(execution.completedAt) : "Not completed"}
          title={execution.completedAt ?? undefined}
        />
        <SummaryCard
          label="Selected resource"
          value={selectedResource?.title ?? "Unavailable"}
        />
        <SummaryCard
          label="Estimated cost"
          value={execution.estimatedCostUSDC === null ? "Unavailable" : formatUSDC(execution.estimatedCostUSDC)}
        />
        <SummaryCard
          label="Transaction"
          value={
            execution.txHash ? (
              <InlineCopy
                value={execution.txHash}
                label={abbreviateIdentifier(execution.txHash, { start: 8, end: 6 })}
              />
            ) : (
              "Unavailable"
            )
          }
        />
      </section>

      <section style={contentPanelStyle} aria-label="Goal and policy">
        <SectionHeader
          eyebrow="Goal and policy"
          title="Historical execution snapshot"
          copy="The historical policy snapshot and goal plan are read from the persisted execution record."
        />

        <div style={definitionGridStyle}>
          <Definition label="Policy name" value={execution.policy?.policyName ?? "Legacy or ad hoc policy"} />
          <Definition label="Policy ID" value={execution.policy?.policyId ?? "Unavailable"} />
          <Definition
            label="Policy version"
            value={execution.policy?.policyVersion ? `v${execution.policy.policyVersion}` : "Unavailable"}
          />
          <Definition
            label="Overrides"
            value={execution.policy?.overridesApplied?.length ? execution.policy.overridesApplied.join(", ") : "None"}
          />
          <Definition label="Original goal" value={execution.goal?.originalGoal ?? "Unavailable"} />
          <Definition label="Normalized goal" value={execution.normalizedGoal ?? execution.goal?.normalizedQuery ?? "Unavailable"} />
          <Definition
            label="Daily budget"
            value={execution.policy ? formatUSDC(execution.policy.dailyBudgetUSDC ?? execution.policy.remainingBudgetUSDC) : "Unavailable"}
          />
          <Definition
            label="Remaining budget"
            value={execution.policy ? formatUSDC(execution.policy.remainingBudgetUSDC) : "Unavailable"}
          />
          <Definition
            label="Maximum purchase"
            value={execution.policy ? formatUSDC(execution.policy.maxPurchaseUSDC) : "Unavailable"}
          />
          <Definition
            label="Minimum score"
            value={execution.policy ? `${execution.policy.minimumScore ?? execution.policy.minimumMatchScore}/100` : "Unavailable"}
          />
          <Definition
            label="Goal budget"
            value={
              execution.goal?.maximumPriceUSDC !== undefined
                ? formatUSDC(execution.goal.maximumPriceUSDC)
                : "Unavailable"
            }
          />
          <Definition
            label="Policy keywords"
            value={execution.goal?.keywords?.length ? execution.goal.keywords.join(", ") : "Unavailable"}
          />
        </div>
      </section>

      <section style={contentPanelStyle} aria-label="Recommendation">
        <SectionHeader
          eyebrow="Recommendation"
          title={isBuy ? "BUY recommendation" : "SKIP recommendation"}
          copy={
            isBuy
              ? "The agent selected a resource that met the persisted budget policy."
              : "The agent did not recommend a purchase for this execution."
          }
        />

        {isBuy && selectedResource && selectedEvaluation ? (
          <div style={recommendationGridStyle}>
            <RecommendationCard title="Selected resource">
              <RecommendationLine label="Title" value={selectedResource.title} />
              <RecommendationLine label="Type" value={selectedResource.resourceType} />
              <RecommendationLine
                label="Collection"
                value={selectedResource.aiCollection ?? selectedResource.aiPlacement ?? "Uncategorized"}
              />
              <RecommendationLine label="Category" value={selectedResource.aiCategory ?? "Unavailable"} />
              <RecommendationLine label="Price" value={formatUSDC(selectedResource.priceUSDC)} />
            </RecommendationCard>

            <RecommendationCard title="Selected evaluation">
              <RecommendationLine label="Match score" value={`${selectedEvaluation.matchScore}/100`} />
              <RecommendationLine
                label="Budget eligible"
                value={selectedEvaluation.budgetEligible ? "Yes" : "No"}
              />
              <RecommendationLine
                label="Matched keywords"
                value={selectedEvaluation.matchedKeywords.length ? selectedEvaluation.matchedKeywords.join(", ") : "None"}
              />
              <RecommendationLine
                label="Reasons"
                value={selectedEvaluation.reasons.length ? selectedEvaluation.reasons.join(" ") : "Unavailable"}
              />
              <RecommendationLine
                label="Budget impact"
                value={
                  budgetRemainingAfterPurchase === null
                    ? "Unavailable"
                    : `Remaining after purchase: ${formatUSDC(budgetRemainingAfterPurchase)}`
                }
              />
            </RecommendationCard>

            {execution.comparisonSummary ? (
              <RecommendationCard title="Comparison summary">
                <RecommendationLine
                  label="Candidate count"
                  value={String(execution.comparisonSummary.candidateCount)}
                />
                <RecommendationLine
                  label="Budget eligible"
                  value={String(execution.comparisonSummary.budgetEligibleCount)}
                />
                <RecommendationLine
                  label="Top score"
                  value={
                    execution.comparisonSummary.topMatchScore === null
                      ? "Unavailable"
                      : `${execution.comparisonSummary.topMatchScore}/100`
                  }
                />
                <RecommendationLine
                  label="Summary"
                  value={execution.comparisonSummary.summary}
                />
              </RecommendationCard>
            ) : null}
          </div>
        ) : (
          <div style={skipPanelStyle}>
            <div style={recommendationGridStyle}>
              <RecommendationCard title="Skip reason">
                <RecommendationLine
                  label="Summary"
                  value={execution.comparisonSummary?.summary ?? "No purchase was recommended."}
                />
                <RecommendationLine
                  label="Decision"
                  value={execution.decision ?? "Unavailable"}
                />
                <RecommendationLine
                  label="Trace explanation"
                  value={execution.trace.length ? execution.trace[execution.trace.length - 1]?.message : "Unavailable"}
                />
              </RecommendationCard>

              <RecommendationCard title="Best candidate">
                <RecommendationLine
                  label="Title"
                  value={bestCandidate?.resource.title ?? "Unavailable"}
                />
                <RecommendationLine
                  label="Highest score"
                  value={bestCandidate ? `${bestCandidate.matchScore}/100` : "Unavailable"}
                />
                <RecommendationLine
                  label="Budget eligible"
                  value={bestCandidate ? (bestCandidate.budgetEligible ? "Yes" : "No") : "Unavailable"}
                />
                <RecommendationLine
                  label="Threshold miss"
                  value={
                    execution.policy && bestCandidate
                      ? bestCandidate.matchScore < execution.policy.minimumMatchScore
                        ? `Below ${execution.policy.minimumMatchScore}/100`
                        : "Within threshold"
                      : "Unavailable"
                  }
                />
              </RecommendationCard>
            </div>
          </div>
        )}
      </section>

      {execution.approval ? (
        <section style={contentPanelStyle} aria-label="Approval">
          <SectionHeader
            eyebrow="Approval"
            title="Owner decision"
            copy="The execution remains linked to this approval record even if the saved policy changes later."
          />

          <div style={approvalGridStyle}>
            <AgentApprovalDecisionPanel approval={execution.approval} readOnly={execution.approval.status !== "PENDING"} />
            <div style={approvalNotesStyle}>
              <p style={approvalNotesTitleStyle}>Approval snapshot</p>
              <div style={definitionGridStyle}>
                <Definition label="Decision" value={execution.approval.decision ?? "Pending"} />
                <Definition label="Reason code" value={execution.approval.reasonCode ?? "Unavailable"} />
                <Definition label="Reason text" value={execution.approval.reasonText ?? "Unavailable"} />
                <Definition
                  label="Expires"
                  value={execution.approval.expiresAt ? formatDateTime(execution.approval.expiresAt) : "No expiration"}
                  title={execution.approval.expiresAt ?? undefined}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section style={contentPanelStyle} aria-label="Candidate comparison">
        <SectionHeader
          eyebrow="Candidate comparison"
          title="Persisted marketplace evaluation"
          copy="The original candidate order and safe scores are preserved from the execution snapshot."
        />

        {execution.candidates.length > 0 ? (
          <div style={candidateGridStyle}>
            {execution.candidates.map((candidate, index) => {
              const isSelected =
                selectedResource?.id === candidate.resource.id ||
                execution.comparisonSummary?.selectedCandidateId === candidate.resource.id;

              return (
                <article key={`${candidate.resource.id}-${index}`} style={candidateCardStyle(isSelected)}>
                  <div style={candidateHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <p style={candidateIndexStyle}>Candidate {String(index + 1).padStart(2, "0")}</p>
                      <h3 style={candidateTitleStyle}>{candidate.resource.title}</h3>
                    </div>
                    {isSelected ? <span style={selectedPillStyle}>Selected</span> : null}
                  </div>

                  <div style={candidateMetaGridStyle}>
                    <MiniField label="Score" value={`${candidate.matchScore}/100`} />
                    <MiniField label="Price" value={formatUSDC(candidate.resource.priceUSDC)} />
                    <MiniField label="Eligibility" value={candidate.budgetEligible ? "Eligible" : "Over budget"} />
                    <MiniField label="Category" value={candidate.resource.aiCategory ?? "Unavailable"} />
                    <MiniField
                      label="Collection"
                      value={candidate.resource.aiCollection ?? candidate.resource.aiPlacement ?? "Uncategorized"}
                    />
                  </div>

                  <div style={candidateSectionStyle}>
                    <p style={candidateLabelStyle}>Matched keywords</p>
                    <p style={candidateValueStyle}>
                      {candidate.matchedKeywords.length ? candidate.matchedKeywords.join(", ") : "None"}
                    </p>
                  </div>

                  <div style={candidateSectionStyle}>
                    <p style={candidateLabelStyle}>Reasons</p>
                    <ul style={candidateListStyle}>
                      {candidate.reasons.length > 0 ? (
                        candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)
                      ) : (
                        <li>No additional reasons were persisted.</li>
                      )}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            <p style={emptyCopyStyle}>No candidate comparison snapshot was persisted for this execution.</p>
          </div>
        )}
      </section>

      <AgentExecutionTimeline execution={execution} />

      {purchase ? (
        <section style={contentPanelStyle} aria-label="Purchase and unlock">
          <SectionHeader
            eyebrow="Purchase and unlock"
            title="Settlement and unlock lifecycle"
            copy="Only the trusted server-side purchase path can advance these states."
          />

          <div style={definitionGridStyle}>
            <Definition label="Approval state" value={purchase.status} />
            <Definition label="Payment state" value={purchase.status} />
            <Definition
              label="Amount"
              value={purchase.amountUSDC === null ? "Unavailable" : formatUSDC(purchase.amountUSDC)}
            />
            <Definition label="Transaction ID" value={purchase.transactionId ?? "Unavailable"} />
            <Definition label="Settlement state" value={purchase.settlementStatus} />
            <Definition label="Unlock state" value={purchase.unlockStatus} />
            <Definition
              label="Settlement verified"
              value={purchase.settlementStatus === "SETTLED" ? "Confirmed" : purchase.settlementStatus === "FAILED" ? "Failed" : "Pending"}
            />
            <Definition
              label="Unlocked"
              value={purchase.unlockStatus === "UNLOCKED" ? "Confirmed" : purchase.unlockStatus === "FAILED" ? "Failed" : "Pending"}
            />
          </div>

          {purchase.status === "AWAITING_APPROVAL" ? (
            <p style={noticeStyle}>Approval was requested and is awaiting owner confirmation.</p>
          ) : purchase.status === "NOT_STARTED" && execution.decision === "BUY" && execution.status === "RECOMMENDED_BUY" ? (
            <p style={noticeStyle}>Approval was cancelled before payment. No payment was claimed.</p>
          ) : purchase.status === "FAILED" ? (
            <p style={noticeStyle}>The purchase was not completed and no unlock was claimed.</p>
          ) : null}
        </section>
      ) : null}

      {execution.failure ? (
        <section style={failurePanelStyle} aria-label="Failure details">
          <SectionHeader
            eyebrow="Failure"
            title="Safe failure details"
            copy="The execution failed safely without exposing provider internals or stack traces."
          />

          <div style={definitionGridStyle}>
            <Definition label="Failure stage" value={execution.failure.stage ?? "Unavailable"} />
            <Definition label="Failure code" value={execution.failure.code} />
            <Definition label="Message" value={execution.failure.message} />
            <Definition
              label="Completed"
              value={execution.completedAt ? formatDateTime(execution.completedAt) : "Unavailable"}
              title={execution.completedAt ?? undefined}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div style={sectionHeaderStyle}>
      <div>
        <p style={eyebrowStyle}>{eyebrow}</p>
        <h2 style={sectionTitleStyle}>{title}</h2>
      </div>
      {copy ? <p style={sectionCopyStyle}>{copy}</p> : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div style={summaryCardStyle}>
      <p style={summaryLabelStyle}>{label}</p>
      <p style={summaryValueStyle} title={title}>
        {value}
      </p>
    </div>
  );
}

function Definition({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div style={definitionStyle}>
      <p style={definitionLabelStyle}>{label}</p>
      <p style={definitionValueStyle} title={title}>
        {value}
      </p>
    </div>
  );
}

function InlineCopy({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span style={inlineCopyStyle}>
      <span title={value} style={inlineCopyValueStyle}>
        {label}
      </span>
      <CopyValueButton value={value} label="Copy" />
    </span>
  );
}

function RecommendationCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={recommendationCardStyle}>
      <p style={recommendationTitleStyle}>{title}</p>
      <div style={recommendationCardBodyStyle}>{children}</div>
    </section>
  );
}

function RecommendationLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={recommendationLineStyle}>
      <p style={recommendationLineLabelStyle}>{label}</p>
      <p style={recommendationLineValueStyle}>{value}</p>
    </div>
  );
}

function MiniField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={miniFieldStyle}>
      <p style={miniFieldLabelStyle}>{label}</p>
      <p style={miniFieldValueStyle}>{value}</p>
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: 18,
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const titleBlockStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const titleStyle = {
  fontSize: "clamp(28px, 4vw, 40px)",
  lineHeight: 1.1,
  color: "var(--text-primary)",
  overflowWrap: "anywhere" as const,
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  maxWidth: 820,
} as const;

const headerActionsStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
} as const;

const primaryLinkStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const;

const secondaryLinkStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  textDecoration: "none",
} as const;

const summaryPanelStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} as const;

const summaryCardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 8,
} as const;

const summaryLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const summaryValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const contentPanelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const failurePanelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid rgba(224,82,82,0.24)",
  background: "rgba(224,82,82,0.05)",
  padding: 20,
} as const;

const sectionHeaderStyle = {
  display: "grid",
  gap: 8,
} as const;

const sectionTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const sectionCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
  maxWidth: 840,
} as const;

const definitionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} as const;

const definitionStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const definitionLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const definitionValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const inlineCopyStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
} as const;

const inlineCopyValueStyle = {
  overflowWrap: "anywhere" as const,
} as const;

const recommendationGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 12,
} as const;

const approvalGridStyle = {
  display: "grid",
  gap: 12,
} as const;

const approvalNotesStyle = {
  display: "grid",
  gap: 12,
} as const;

const approvalNotesTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const recommendationCardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 12,
} as const;

const recommendationTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const recommendationCardBodyStyle = {
  display: "grid",
  gap: 10,
  minWidth: 0,
} as const;

const recommendationLineStyle = {
  display: "grid",
  gap: 4,
  minWidth: 0,
} as const;

const recommendationLineLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const recommendationLineValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const skipPanelStyle = {
  display: "grid",
  gap: 12,
} as const;

const candidateGridStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
} as const;

const candidateCardStyle = (selected: boolean) =>
  ({
    borderRadius: 16,
    border: selected ? "1px solid rgba(0,194,168,0.3)" : "1px solid var(--border-subtle)",
    background: selected ? "rgba(0,194,168,0.05)" : "rgba(255,255,255,0.02)",
    padding: 16,
    display: "grid",
    gap: 12,
    minWidth: 0,
  }) as const;

const candidateHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const candidateIndexStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const candidateTitleStyle = {
  fontSize: 16,
  lineHeight: 1.35,
  color: "var(--text-primary)",
  overflowWrap: "anywhere" as const,
} as const;

const selectedPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  background: "rgba(0,194,168,0.08)",
  border: "1px solid rgba(0,194,168,0.25)",
  borderRadius: 999,
  padding: "6px 9px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const candidateMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
} as const;

const miniFieldStyle = {
  borderRadius: 12,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 12,
  minWidth: 0,
} as const;

const miniFieldLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const miniFieldValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const candidateSectionStyle = {
  display: "grid",
  gap: 8,
} as const;

const candidateLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const candidateValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const candidateListStyle = {
  listStyle: "disc",
  marginLeft: 18,
  display: "grid",
  gap: 6,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const emptyStateStyle = {
  borderRadius: 14,
  border: "1px dashed var(--border)",
  background: "rgba(255,255,255,0.015)",
  padding: 18,
} as const;

const emptyCopyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;

const noticeStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.7,
} as const;
