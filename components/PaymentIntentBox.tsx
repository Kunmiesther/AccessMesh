"use client";

import { useState } from "react";
import { type Address, type Hash } from "viem";
import { postUnlock } from "@/lib/api";
import type { ModularWalletSession } from "@/lib/modular-wallet";
import { executeUsdcPayment } from "@/lib/usdc-transfer";
import type { PaymentIntent } from "@/types";

type Props = {
  intent: PaymentIntent;
  walletAddress: string;
  smartAccount: ModularWalletSession["smartAccount"] | null;
  bundlerClient: ModularWalletSession["bundlerClient"] | null;
  onUnlocked: (resource: PaymentIntent["resource"], txHash: string) => void;
};

type Step = "idle" | "paying" | "verifying" | "confirming" | "error";

export function PaymentIntentBox({
  intent,
  walletAddress,
  smartAccount,
  bundlerClient,
  onUnlocked,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmingMsg, setConfirmingMsg] = useState("");

  async function handleUnlock() {
    if (!smartAccount || !bundlerClient) {
      setErrorMsg("Active wallet session is not available. Refresh and sign in again if the session has expired.");
      return;
    }

    setStep("paying");
    setErrorMsg("");
    setConfirmingMsg("");
    setTxHash(null);

    try {
      const hash = await executeUsdcPayment({
        bundlerClient,
        transfers: [
          {
            recipientWallet: intent.creatorWallet as Address,
            amountUSDC: intent.creatorAmountUSDC,
          },
          {
            recipientWallet: intent.treasuryWallet as Address,
            amountUSDC: intent.treasuryAmountUSDC,
          },
        ],
      });
      setTxHash(hash);

      setStep("verifying");
      const result = await postUnlock(
        {
          accessId: intent.accessId,
          txHash: hash,
        },
        {
          wallet: walletAddress,
        },
      );

      if (result.ok) {
        onUnlocked(result.resource, result.txHash);
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
        err instanceof Error ? err.message : "Payment or verification failed.",
      );
    }
  }

  const isLoading = step === "paying" || step === "verifying";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
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
          value={`${intent.creatorWallet.slice(0, 10)}...${intent.creatorWallet.slice(-8)}`}
        />
        <ReceiptLine
          label="TREASURY"
          value={`${intent.treasuryWallet.slice(0, 10)}...${intent.treasuryWallet.slice(-8)}`}
        />
        <ReceiptLine
          label="SPLIT"
          value={`${intent.creatorAmountUSDC.toFixed(2)} / ${intent.treasuryAmountUSDC.toFixed(2)} USDC`}
        />
        <ReceiptLine
          label="FROM"
          value={`${intent.payerWallet.slice(0, 10)}...${intent.payerWallet.slice(-8)}`}
        />
        <ReceiptLine label="INTENT" value={`${intent.accessId.slice(0, 20)}...`} />
      </div>

      {step !== "confirming" && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--accent-dim)",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Unlock executes a Circle Modular Wallet transfer for exactly{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
              {intent.amountUSDC.toFixed(2)} USDC
            </span>{" "}
            as a split payment on Arc, then verifies settlement and grants access automatically.
          </p>
        </div>
      )}

      {step === "confirming" && (
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            background: "#c8972a10",
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
            Confirming - {confirmingMsg}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            Your payment was submitted. Access will be granted once Arc verification reports
            final settlement.
          </p>
        </div>
      )}

      {step !== "confirming" && (
        <div style={{ padding: "16px 20px" }}>
          {txHash && (
            <div style={{ marginBottom: 12 }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Transaction hash
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  overflowWrap: "anywhere",
                  lineHeight: 1.5,
                }}
              >
                {txHash}
              </p>
            </div>
          )}

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
            onClick={handleUnlock}
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
          >
            {step === "paying"
              ? "Executing USDC payment..."
              : step === "verifying"
                ? "Verifying settlement..."
                : "Pay and unlock"}
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
