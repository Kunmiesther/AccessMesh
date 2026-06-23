"use client";

import { useState } from "react";
import type { PaymentIntent } from "@/types";
import { postUnlock } from "@/lib/api";

type Props = {
  intent: PaymentIntent;
  onUnlocked: (accessToken: string, resourceId: string) => void;
};

type Step = "idle" | "submitting" | "verifying" | "confirming" | "error";

export function PaymentIntentBox({ intent, onUnlocked }: Props) {
  const [txHash, setTxHash] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmingMsg, setConfirmingMsg] = useState("");

  async function handleSubmit() {
    const hash = txHash.trim();
    if (!hash) {
      setErrorMsg("Paste the transaction hash from your Arc USDC transfer.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setErrorMsg("Invalid transaction hash format. Must be 0x followed by 64 hex characters.");
      return;
    }

    setStep("submitting");
    setErrorMsg("");

    try {
      setStep("verifying");
      const result = await postUnlock({
        accessId: intent.accessId,
        txHash: hash,
      });

      if (result.ok && result.accessToken && result.resourceId) {
        onUnlocked(result.accessToken, result.resourceId);
        return;
      }

      if (result.verification?.status === "CONFIRMING") {
        setStep("confirming");
        setConfirmingMsg(
          result.verification.reason ??
            "Payment is being confirmed on-chain. This may take a few moments.",
        );
        return;
      }

      if (result.verification?.status === "FAILED") {
        setStep("error");
        setErrorMsg("Payment verification failed. Check that the transaction settled correctly.");
        return;
      }

      setStep("error");
      setErrorMsg("Unexpected response from verification. Try again.");
    } catch (err: unknown) {
      setStep("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Verification request failed.",
      );
    }
  }

  const isLoading = step === "submitting" || step === "verifying";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Receipt header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Payment required
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          Arc USDC
        </span>
      </div>

      {/* Receipt body */}
      <div
        style={{
          padding: "20px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <ReceiptLine label="SEND" value={`${intent.amountUSDC.toFixed(2)} USDC`} accent />
        <ReceiptLine
          label="TO"
          value={`${intent.recipientWallet.slice(0, 10)}...${intent.recipientWallet.slice(-8)}`}
        />
        <ReceiptLine
          label="FROM"
          value={`${intent.payerWallet.slice(0, 10)}...${intent.payerWallet.slice(-8)}`}
        />
        <ReceiptLine label="INTENT" value={intent.accessId.slice(0, 20) + "..."} />
      </div>

      {/* Instructions */}
      {step !== "confirming" && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--accent-dim)",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Send exactly{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
              {intent.amountUSDC.toFixed(2)} USDC
            </span>{" "}
            to the address above using Arc. Once your transfer is complete, paste the transaction
            hash below to unlock access.
          </p>
        </div>
      )}

      {/* Confirming state */}
      {step === "confirming" && (
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            background: "#c8972a10",
            border: "1px solid #c8972a30",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--warning)",
              lineHeight: 1.6,
            }}
          >
            ◌ CONFIRMING — {confirmingMsg}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            Your payment has been received. Access will be granted once the transaction is
            confirmed on-chain. You can revisit this page or check your activity on the dashboard.
          </p>
        </div>
      )}

      {/* Input + submit */}
      {step !== "confirming" && (
        <div style={{ padding: "16px 20px" }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Transaction hash
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={txHash}
            onChange={(e) => {
              setTxHash(e.target.value);
              setErrorMsg("");
              if (step === "error") setStep("idle");
            }}
            disabled={isLoading}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              background: "#0a0a0a",
              border: `1px solid ${errorMsg ? "var(--error)" : "var(--border)"}`,
              color: "var(--text-primary)",
              borderRadius: 4,
              padding: "9px 12px",
              marginBottom: errorMsg ? 6 : 12,
              outline: "none",
              opacity: isLoading ? 0.6 : 1,
            }}
          />

          {errorMsg && (
            <p
              style={{
                fontSize: 12,
                color: "var(--error)",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "10px",
              background: isLoading ? "var(--border)" : "var(--accent)",
              color: isLoading ? "var(--text-muted)" : "#000",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "background 0.15s, transform 0.1s",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "var(--accent-hover)";
                e.currentTarget.style.transform = "scale(0.99)";
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            {step === "submitting"
              ? "Submitting..."
              : step === "verifying"
                ? "Verifying settlement..."
                : "Verify and unlock"}
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiptLine({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        marginBottom: 8,
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</span>
      <span
        style={{
          color: accent ? "var(--accent)" : "var(--text-primary)",
          fontSize: accent ? 16 : 13,
          fontWeight: accent ? 500 : 400,
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}