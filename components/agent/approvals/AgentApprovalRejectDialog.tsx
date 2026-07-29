"use client";

import { useEffect, useId, useState } from "react";
import type { AgentApprovalRejectionReason } from "@/services/agent/AgentApprovalTypes";

const REJECTION_REASONS: Array<{
  value: AgentApprovalRejectionReason;
  label: string;
}> = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "LOW_CONFIDENCE", label: "Low confidence" },
  { value: "NOT_RELEVANT", label: "Not relevant" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed" },
  { value: "OTHER", label: "Other" },
];

export function AgentApprovalRejectDialog({
  open,
  title,
  onCancel,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (input: {
    reasonCode: AgentApprovalRejectionReason;
    reasonText: string | null;
  }) => void;
  busy?: boolean;
}) {
  const [reasonCode, setReasonCode] = useState<AgentApprovalRejectionReason>("NO_LONGER_NEEDED");
  const [reasonText, setReasonText] = useState("");
  const reasonId = useId();
  const textId = useId();

  useEffect(() => {
    if (open) {
      setReasonCode("NO_LONGER_NEEDED");
      setReasonText("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={reasonId} style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Reject approval</p>
            <h3 id={reasonId} style={titleStyle}>
              {title}
            </h3>
            <p style={copyStyle}>The recommendation will remain visible, but it will not be actionable.</p>
          </div>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>Reason</span>
          <select
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value as AgentApprovalRejectionReason)}
            style={selectStyle}
            disabled={busy}
          >
            {REJECTION_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle} id={textId}>
            Optional reason text
          </span>
          <textarea
            aria-labelledby={textId}
            value={reasonText}
            onChange={(event) => setReasonText(event.target.value)}
            rows={4}
            maxLength={240}
            placeholder="Optional safe explanation"
            disabled={busy}
            style={textareaStyle}
          />
        </label>

        <div style={actionsStyle}>
          <button type="button" onClick={onCancel} disabled={busy} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                reasonCode,
                reasonText: reasonText.trim().length > 0 ? reasonText.trim() : null,
              })
            }
            disabled={busy}
            style={dangerButtonStyle}
          >
            {busy ? "Rejecting..." : "Reject approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
  background: "rgba(5, 6, 8, 0.72)",
  backdropFilter: "blur(10px)",
  display: "grid",
  placeItems: "center",
  padding: 16,
} as const;

const panelStyle = {
  width: "min(100%, 560px)",
  background: "rgba(13, 15, 17, 0.98)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 20,
  display: "grid",
  gap: 14,
} as const;

const headerStyle = {
  display: "grid",
  gap: 8,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const titleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const copyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;

const fieldStyle = {
  display: "grid",
  gap: 8,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const selectStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
} as const;

const textareaStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
  resize: "vertical" as const,
} as const;

const actionsStyle = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  flexWrap: "wrap",
} as const;

const secondaryButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--warning)",
  background: "var(--warning)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;
