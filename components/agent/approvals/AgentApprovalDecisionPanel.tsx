"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { AgentApprovalDetailView, AgentApprovalRejectionReason } from "@/services/agent/AgentApprovalTypes";
import { formatDateTime } from "@/lib/ui";
import { AgentApprovalRejectDialog } from "./AgentApprovalRejectDialog";
import { AgentApprovalSourceBadge } from "./AgentApprovalSourceBadge";
import { AgentApprovalStatusBadge } from "./AgentApprovalStatusBadge";

export function AgentApprovalDecisionPanel({
  approval,
  readOnly = false,
}: {
  approval: AgentApprovalDetailView;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const currentStatus = approval.status ?? approval.approvalStatus;
  const canAct = currentStatus === "PENDING" && !readOnly;

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

  async function reject(input: {
    reasonCode: AgentApprovalRejectionReason;
    reasonText: string | null;
  }) {
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
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div style={copyStyle}>
          <p style={eyebrowStyle}>Approval</p>
          <h2 style={titleStyle}>Owner decision</h2>
          <p style={leadStyle}>
            Review the persisted BUY recommendation before continuing into the existing payment flow.
          </p>
        </div>
        <div style={badgeRowStyle}>
          <AgentApprovalSourceBadge source={approval.source} />
          <AgentApprovalStatusBadge status={currentStatus} />
        </div>
      </div>

      <div style={contentGridStyle}>
        <Info label="Execution" value={approval.executionId} copyable />
        <Info label="Decision" value={approval.decision ?? "Pending"} />
        <Info label="Policy" value={`${approval.policy.name}${approval.policy.version ? ` v${approval.policy.version}` : ""}`} />
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
          label="Created"
          value={<span title={approval.createdAt}>{formatDateTime(approval.createdAt)}</span>}
        />
        <Info
          label="Decided"
          value={approval.decidedAt ? <span title={approval.decidedAt}>{formatDateTime(approval.decidedAt)}</span> : "Not yet decided"}
        />
      </div>

      {currentStatus === "REJECTED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>Rejected by owner.</p>
          {approval.reasonCode ? <p style={resolvedCopyStyle}>Reason: {approval.reasonCode}</p> : null}
          {approval.reasonText ? <p style={resolvedCopyStyle}>{approval.reasonText}</p> : null}
        </div>
      ) : currentStatus === "APPROVED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>Approved. Continue through the payment review flow when ready.</p>
        </div>
      ) : currentStatus === "EXPIRED" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>This approval expired before it was acted on.</p>
        </div>
      ) : currentStatus === "NO_LONGER_ACTIONABLE" ? (
        <div style={resolvedStyle}>
          <p style={resolvedTextStyle}>This approval is no longer actionable.</p>
        </div>
      ) : null}

      {error ? <p style={errorStyle}>{error}</p> : null}

      <div style={actionsStyle}>
        <Link href={`/agent/executions/${approval.executionId}`} style={secondaryButtonStyle}>
          View execution
        </Link>
        {canAct ? (
          <>
            <button type="button" onClick={approve} disabled={busy} style={approveButtonStyle}>
              {busy ? "Saving..." : "Approve"}
            </button>
            <button type="button" onClick={() => setRejectOpen(true)} disabled={busy} style={rejectButtonStyle}>
              Reject
            </button>
          </>
        ) : null}
      </div>

      <AgentApprovalRejectDialog
        open={rejectOpen}
        title="Reject this BUY recommendation?"
        busy={busy}
        onCancel={() => setRejectOpen(false)}
        onConfirm={reject}
      />
    </section>
  );
}

function Info({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: ReactNode;
  copyable?: boolean;
}) {
  return (
    <div style={infoStyle}>
      <p style={infoLabelStyle}>{label}</p>
      <div style={infoValueStyle}>
        {value}
        {copyable ? <span style={copyHintStyle}>Copy from the execution detail page</span> : null}
      </div>
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
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const copyStyle = {
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
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const leadStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
  maxWidth: 760,
} as const;

const badgeRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const contentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  display: "grid",
  gap: 6,
} as const;

const copyHintStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
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

const secondaryButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;
