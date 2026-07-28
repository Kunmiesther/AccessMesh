"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { shortAddress, formatUSDC } from "@/lib/ui";
import { getAccessIntent } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import type { AgentBudgetPolicy } from "@/services/agent/types";
import type { AgentPurchaseCompletionView, AgentRuntimeResultView } from "./types";
import { canApproveAgentPurchaseReview } from "./agentUi";
import {
  executeAgentPurchaseFlow,
  type AgentPurchaseStage,
  validateAgentPurchaseBinding,
} from "@/services/agent/AgentPurchaseFlow";

const PURCHASE_STAGES: AgentPurchaseStage[] = [
  "REVIEWING",
  "AUTHENTICATING",
  "PREPARING_PAYMENT",
  "AWAITING_APPROVAL",
  "SUBMITTING_PAYMENT",
  "VERIFYING_SETTLEMENT",
  "UNLOCKING_RESOURCE",
  "COMPLETED",
  "FAILED",
];

type Props = {
  open: boolean;
  result: AgentRuntimeResultView | null;
  policy: AgentBudgetPolicy | null;
  onClose: () => void;
  onPurchaseComplete: (completion: AgentPurchaseCompletionView) => void;
};

export function AgentPurchaseReview({
  open,
  result,
  policy,
  onClose,
  onPurchaseComplete,
}: Props) {
  const { address, connected, ready, bundlerClient } = useWallet();
  const [previewIntent, setPreviewIntent] = useState<Awaited<ReturnType<typeof getAccessIntent>>["paymentIntent"] | null>(null);
  const [stage, setStage] = useState<AgentPurchaseStage>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completion, setCompletion] = useState<AgentPurchaseCompletionView | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inFlightRef = useRef(false);

  const selectedResource = result?.selectedResource ?? null;
  const selectedEvaluation = result?.selectedEvaluation ?? null;
  const livePriceUSDC = previewIntent?.amountUSDC ?? selectedResource?.priceUSDC ?? 0;
  const recommendedPriceUSDC = selectedResource?.priceUSDC ?? 0;
  const remainingBudgetUSDC = policy
    ? Math.max(0, policy.remainingBudgetUSDC - livePriceUSDC)
    : 0;
  const canApprove = canApproveAgentPurchaseReview({
    ready,
    connected,
    address,
    bundlerClient,
    result,
    policy,
    previewIntentLoaded: Boolean(previewIntent),
    isSubmitting,
    previewLoading,
    stage,
    error,
  });

  useEffect(() => {
    if (!open) {
      setStage("IDLE");
      setError(null);
      setCompletion(null);
      setPreviewIntent(null);
      setPreviewLoading(false);
      setIsSubmitting(false);
      return;
    }

    setStage("REVIEWING");
    setError(null);
    setCompletion(null);
    setPreviewIntent(null);

    const activeResult = result;
    const activePolicy = policy;
    const activeResource = selectedResource;

    if (!activeResult || !activePolicy || !activeResource) {
      setStage("FAILED");
      setError("A purchase recommendation is required before review.");
      return;
    }

    if (!ready) {
      setStage("AUTHENTICATING");
      setError("Restoring the connected wallet session.");
      return;
    }

    if (!connected || !address) {
      setStage("AUTHENTICATING");
      setError("Connect your Circle Smart Account to approve this purchase.");
      return;
    }

    const activeAddress = address;

    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setStage("PREPARING_PAYMENT");
      setError(null);

      try {
        const response = await getAccessIntent(activeResource!.id, activeAddress);
        if (cancelled) {
          return;
        }

        const validation = validateAgentPurchaseBinding({
          result: activeResult!,
          policy: activePolicy!,
          walletAddress: activeAddress,
          accessIntent: response.paymentIntent,
        });

        if (validation) {
          setPreviewIntent(response.paymentIntent);
          setStage("FAILED");
          setError(validation.message);
          return;
        }

        setPreviewIntent(response.paymentIntent);
        setStage("AWAITING_APPROVAL");
      } catch (previewError) {
        if (cancelled) {
          return;
        }

        setStage("FAILED");
        setError(
          previewError instanceof Error
            ? previewError.message
            : "The live purchase requirement could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [address, connected, open, policy, ready, result, selectedResource]);

  async function handleApprove() {
    if (isSubmitting || inFlightRef.current || !result || !policy || !selectedResource) {
      return;
    }

    if (!ready || !connected || !address || !bundlerClient) {
      setStage("AUTHENTICATING");
      setError("Connect your Circle Smart Account before approving this purchase.");
      return;
    }

    const activeAddress = address;

    if (!previewIntent) {
      setStage("PREPARING_PAYMENT");
      setError("Load the live marketplace price before approving this purchase.");
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const activeResult = result;
    const activePolicy = policy;
    const activeResource = selectedResource;

    try {
      const liveIntentResponse = await getAccessIntent(activeResource.id, activeAddress);
      const outcome = await executeAgentPurchaseFlow({
        result: activeResult!,
        policy: activePolicy!,
        walletAddress: activeAddress,
        bundlerClient,
        accessIntent: liveIntentResponse.paymentIntent,
        onStage: ({ phase, message }) => {
          setStage(phase);
        },
      });

      if (!outcome.ok) {
        setStage("FAILED");
        setError(outcome.message);
        return;
      }

      setCompletion(outcome.completion);
      onPurchaseComplete(outcome.completion);
      setStage("COMPLETED");
    } catch (purchaseError) {
      setStage("FAILED");
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "The purchase could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
      inFlightRef.current = false;
    }
  }

  if (!open) {
    return null;
  }

  const stageIndex = Math.max(
    0,
    PURCHASE_STAGES.indexOf(stage),
  );

  return (
    <div style={overlayStyle} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-purchase-review-title"
        style={panelStyle}
      >
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Purchase review</p>
            <h2 id="agent-purchase-review-title" style={titleStyle}>
              Approve a real AccessMesh purchase
            </h2>
            <p style={helperStyle}>
              Payment will unlock this specific resource using the existing
              Circle and Arc settlement path.
            </p>
          </div>

          <button type="button" onClick={onClose} disabled={isSubmitting} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <div style={summaryGridStyle}>
          <InfoCard label="Selected resource" value={selectedResource?.title ?? "Unknown"} />
          <InfoCard label="Resource type" value={selectedResource?.resourceType ?? "Unknown"} />
          <InfoCard
            label="Agent match score"
            value={`${selectedEvaluation?.matchScore ?? 0}/100`}
          />
          <InfoCard
            label="Matched keywords"
            value={selectedEvaluation?.matchedKeywords.join(", ") || "None"}
          />
          <InfoCard
            label="Payment network"
            value="Arc Testnet"
          />
          <InfoCard
            label="Authenticated account"
            value={address ? shortAddress(address) : "Unavailable"}
          />
          <InfoCard
            label="Starting budget"
            value={policy ? formatUSDC(policy.remainingBudgetUSDC) : formatUSDC(0)}
          />
          <InfoCard
            label="Estimated remaining budget"
            value={formatUSDC(remainingBudgetUSDC)}
          />
        </div>

        <div style={noticeStyle}>
          <p style={noticeCopyStyle}>
            {stage === "COMPLETED"
              ? "Purchase complete."
              : "The selected resource will stay locked until settlement is verified."}
          </p>
          <p style={noticeMetaStyle}>
            Recommended price: {formatUSDC(recommendedPriceUSDC)}.
            {previewIntent ? ` Live price: ${formatUSDC(livePriceUSDC)}.` : ""}
          </p>
        </div>

        {error ? (
          <div style={errorStyle} role="alert">
            <p style={errorTitleStyle}>Purchase blocked</p>
            <p style={errorCopyStyle}>{error}</p>
          </div>
        ) : null}

        <div style={stageBoxStyle} aria-live="polite">
          <p style={sectionLabelStyle}>Purchase state</p>
          <ol style={stageListStyle}>
            {PURCHASE_STAGES.map((item, index) => (
              <li key={item} style={stageItemStyle(index, stageIndex, stage)}>
                <span style={stageNameStyle}>{item.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ol>
          {previewLoading ? (
            <p style={stageMessageStyle}>Loading the live marketplace price...</p>
          ) : (
            <p style={stageMessageStyle}>
              {stage === "AWAITING_APPROVAL"
                ? "Review the recommendation and approve the purchase when ready."
                : stage === "COMPLETED"
                  ? "Purchase complete."
                  : stage === "FAILED"
                    ? "The purchase was not completed."
                    : "The review is ready for approval."}
            </p>
          )}
        </div>

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove}
            style={approveButtonStyle(!canApprove)}
          >
            {isSubmitting ? "Submitting payment..." : "Approve and purchase"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>
        </div>

        {completion ? (
          <div style={completionStyle}>
            <p style={sectionLabelStyle}>Purchase complete</p>
            <div style={completionGridStyle}>
              <InfoCard label="Resource" value={completion.resourceTitle} />
              <InfoCard label="Amount paid" value={formatUSDC(completion.amountUSDC)} />
              <InfoCard label="Settlement status" value={completion.settlementStatus} />
              <InfoCard
                label="Unlocked"
                value={completion.unlocked ? "Confirmed" : "Pending"}
              />
            </div>
            <div style={completionActionsStyle}>
              <Link href={`/resource/${completion.resourceId}`} style={primaryLinkStyle}>
                Open unlocked resource
              </Link>
              {completion.explorerUrl ? (
                <a
                  href={completion.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={secondaryLinkStyle}
                >
                  View settlement
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <p style={infoLabelStyle}>{label}</p>
      <p style={infoValueStyle}>{value}</p>
    </div>
  );
}

function stageItemStyle(index: number, currentIndex: number, stage: AgentPurchaseStage) {
  const isComplete = index < currentIndex || stage === "COMPLETED";
  const isActive = index === currentIndex && stage !== "FAILED" && stage !== "COMPLETED";

  return {
    borderRadius: 12,
    border: isActive
      ? "1px solid rgba(0,194,168,0.35)"
      : "1px solid var(--border-subtle)",
    background: isComplete
      ? "rgba(0,194,168,0.08)"
      : "rgba(255,255,255,0.02)",
    padding: "10px 12px",
    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
  } as const;
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  background: "rgba(5, 6, 8, 0.72)",
  backdropFilter: "blur(10px)",
  display: "grid",
  placeItems: "center",
  padding: 16,
} as const;

const panelStyle = {
  width: "min(100%, 920px)",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  background: "rgba(13, 15, 17, 0.98)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 20,
  display: "grid",
  gap: 16,
  boxShadow: "0 22px 80px rgba(0,0,0,0.45)",
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
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
  fontSize: 24,
  lineHeight: 1.2,
  color: "var(--text-primary)",
  marginBottom: 8,
} as const;

const helperStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 14,
} as const;

const closeButtonStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  padding: "10px 14px",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
} as const;

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
} as const;

const infoCardStyle = {
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
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const noticeStyle = {
  borderRadius: 16,
  border: "1px solid rgba(0,194,168,0.18)",
  background: "rgba(0,194,168,0.05)",
  padding: 16,
  display: "grid",
  gap: 6,
} as const;

const noticeCopyStyle = {
  color: "var(--text-primary)",
  lineHeight: 1.6,
  fontSize: 14,
} as const;

const noticeMetaStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  fontSize: 13,
} as const;

const errorStyle = {
  borderRadius: 16,
  border: "1px solid rgba(224,82,82,0.28)",
  background: "rgba(224,82,82,0.08)",
  padding: 16,
  display: "grid",
  gap: 6,
} as const;

const errorTitleStyle = {
  color: "var(--error)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const errorCopyStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const stageBoxStyle = {
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 16,
  display: "grid",
  gap: 12,
} as const;

const sectionLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const stageListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
  listStyle: "none",
} as const;

const stageNameStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  lineHeight: 1.4,
} as const;

const stageMessageStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const actionsStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
} as const;

const approveButtonStyle = (disabled: boolean) =>
  ({
    borderRadius: 12,
    border: "1px solid var(--accent)",
    background: disabled ? "rgba(0,194,168,0.4)" : "var(--accent)",
    color: "#000",
    padding: "12px 16px",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  }) as const;

const secondaryButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  padding: "12px 16px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  cursor: "pointer",
} as const;

const completionStyle = {
  borderRadius: 16,
  border: "1px solid rgba(76,175,125,0.3)",
  background: "rgba(76,175,125,0.08)",
  padding: 16,
  display: "grid",
  gap: 12,
} as const;

const completionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
} as const;

const completionActionsStyle = {
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
  background: "transparent",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  textDecoration: "none",
} as const;
