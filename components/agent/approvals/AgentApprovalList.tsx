import { AgentApprovalCard } from "./AgentApprovalCard";
import type { AgentApprovalSummaryView } from "@/services/agent/AgentApprovalTypes";
import { AgentApprovalEmptyState } from "./AgentApprovalEmptyState";
import { AgentApprovalPagination } from "./AgentApprovalPagination";

export function AgentApprovalList({
  approvals,
  nextCursor,
  emptyTitle,
  emptyCopy,
  readOnly = false,
}: {
  approvals: AgentApprovalSummaryView[];
  nextCursor: string | null;
  emptyTitle?: string;
  emptyCopy?: string;
  readOnly?: boolean;
}) {
  if (approvals.length === 0) {
    return <AgentApprovalEmptyState title={emptyTitle} copy={emptyCopy} />;
  }

  return (
    <section style={panelStyle} aria-label="Approval list">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Approvals</p>
          <h2 style={titleStyle}>{readOnly ? "Recent resolved approvals" : "Pending approvals"}</h2>
        </div>
      </div>

      <div style={listStyle}>
        {approvals.map((approval) => (
          <AgentApprovalCard key={approval.id} approval={approval} readOnly={readOnly} />
        ))}
      </div>

      {!readOnly ? <AgentApprovalPagination nextCursor={nextCursor} pending /> : null}
    </section>
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

const listStyle = {
  display: "grid",
  gap: 14,
} as const;
