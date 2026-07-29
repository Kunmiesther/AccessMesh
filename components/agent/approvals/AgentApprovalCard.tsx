"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { abbreviateIdentifier, formatDateTime } from "@/lib/ui";
import type { AgentApprovalSummaryView } from "@/services/agent/AgentApprovalTypes";
import { AgentApprovalRejectDialog } from "./AgentApprovalRejectDialog";
import { AgentApprovalSourceBadge } from "./AgentApprovalSourceBadge";
import { AgentApprovalStatusBadge } from "./AgentApprovalStatusBadge";

export function AgentApprovalCard({
  approval,
  readOnly = false,
}: {
  approval: AgentApprovalSummaryView;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const canAct = approval.approvalStatus === "PENDING" && !readOnly;

  async function approve() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/agent/approvals/${approval.id}/approve`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError(parseError(payload) ?? "The approval could not be updated.");
        return;
      }

      router.refresh();
    });
  }

  async function reject(input: { reasonCode: string; reasonText: string | null }) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/agent/approvals/${approval.id}/reject`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError(parseError(payload) ?? "The approval could not be rejected.");
        return;
      }

      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <article style={cardStyle(approval.approvalStatus)}>
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <div style={badgeRowStyle}>
            <AgentApprovalSourceBadge source={approval.source} />
            <AgentApprovalStatusBadge status={approval.approvalStatus} />
          </div>
          <h3 style={titleStyle}>{approval.goal}</h3>
        </div>

        <Link href={`/agent/executions/${approval.executionId}`} style={viewLinkStyle}>
          View details
        </Link>
      </div>

      <div style={bodyGridStyle}>
        <Info label="Resource" value={approval.resource.title} />
        <Info
          label="Estimated cost"
          value={approval.recommendation.estimatedCostUSDC ? `${approval.recommendation.estimatedCostUSDC} USDC` : "Unavailable"}
        />
        <Info
          label="Score"
          value={approval.recommendation.score === null ? "Unavailable" : `${approval.recommendation.score}/100`}
        />
        <Info
          label="Policy"
          value={`${approval.policy.name}${approval.policy.version ? ` v${approval.policy.version}` : ""}`}
        />
        <Info
          label="Recommendation"
          value={approval.recommendation.comparisonSummary ?? "Unavailable"}
        />
        <Info
          label="Created"
          value={<span title={approval.createdAt}>{formatDateTime(approval.createdAt)}</span>}
        />
      </div>

      {approval.approvalStatus === "REJECTED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>Rejected by owner.</p>
          {approval.reasonText ? <p style={resolvedCopyStyle}>{approval.reasonText}</p> : null}
        </div>
      ) : approval.approvalStatus === "APPROVED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>Approved. Continue the purchase in the live Research Agent flow.</p>
        </div>
      ) : approval.approvalStatus === "EXPIRED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>This approval expired before it was acted on.</p>
        </div>
      ) : null}

      {error ? <p style={errorStyle}>{error}</p> : null}

      {canAct ? (
        <div style={actionsStyle}>
          <button type="button" onClick={approve} disabled={pending} style={approveButtonStyle}>
            {pending ? "Saving..." : "Approve"}
          </button>
          <button type="button" onClick={() => setRejectOpen(true)} disabled={pending} style={rejectButtonStyle}>
            Reject
          </button>
        </div>
      ) : null}

      <AgentApprovalRejectDialog
        open={rejectOpen}
        title="Reject this BUY recommendation?"
        busy={pending}
        onCancel={() => setRejectOpen(false)}
        onConfirm={reject}
      />
    </article>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div style={infoStyle}>
      <p style={infoLabelStyle}>{label}</p>
      <p style={infoValueStyle}>{value}</p>
    </div>
  );
}

function parseError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as { error?: { message?: string } | string };
  if (typeof record.error === "string") {
    return record.error;
  }

  return record.error?.message ?? null;
}

const cardStyle = (status: AgentApprovalSummaryView["approvalStatus"]) =>
  ({
    borderRadius: 18,
    border:
      status === "REJECTED"
        ? "1px solid rgba(200,151,42,0.28)"
        : status === "APPROVED"
          ? "1px solid rgba(76,175,125,0.28)"
          : status === "EXPIRED"
            ? "1px solid var(--border)"
            : "1px solid var(--border)",
    background:
      status === "REJECTED"
        ? "rgba(200,151,42,0.04)"
        : status === "APPROVED"
          ? "rgba(76,175,125,0.05)"
          : "rgba(13, 15, 17, 0.96)",
    padding: 18,
    display: "grid",
    gap: 14,
    minWidth: 0,
  }) as const;

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
  fontSize: 17,
  lineHeight: 1.4,
  overflowWrap: "anywhere" as const,
} as const;

const viewLinkStyle = {
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

const bodyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
} as const;

const infoStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const infoLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const infoValueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere" as const,
} as const;

const resolvedStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  display: "grid",
  gap: 6,
} as const;

const resolvedTextStyle = {
  color: "var(--text-primary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const resolvedCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const errorStyle = {
  borderRadius: 12,
  border: "1px solid rgba(224,82,82,0.25)",
  background: "rgba(224,82,82,0.08)",
  color: "var(--error)",
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const actionsStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
} as const;

const approveButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const rejectButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
} as const;
