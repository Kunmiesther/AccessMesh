"use client";

import { useState } from "react";
import { formatUnits, type Address, type Hash } from "viem";
import { postCctpBridgeEvent, postUnlock } from "@/lib/api";
import {
  amountToUsdcSubunits,
  executeCctpBridge,
  findSupportedSourceBalance,
  getCctpQuote,
  readArcUsdcBalance,
  type CctpBridgeExecution,
  type CctpQuote,
  type SourceUsdcBalance,
} from "@/lib/cctp-client";
import { cctpDestinationChain } from "@/lib/cctp-config";
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

type ProgressStep =
  | "Checking balances..."
  | "Preparing bridge..."
  | "Bridging USDC..."
  | "USDC received on Arc..."
  | "Unlocking resource..."
  | "Complete";

type BridgePrompt = {
  sourceBalance: SourceUsdcBalance;
  quote: CctpQuote;
  amountUSDC: number;
};

export function PaymentIntentBox({
  intent,
  walletAddress,
  smartAccount,
  bundlerClient,
  onUnlocked,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState<ProgressStep | null>(null);
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<Hash | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmingMsg, setConfirmingMsg] = useState("");

  async function handleUnlock() {
    setBridgePrompt(null);
    await checkBalancesThenUnlock();
  }

  async function checkBalancesThenUnlock() {
    if (!smartAccount || !bundlerClient) {
      setErrorMsg("Active wallet session is not available. Refresh and sign in again if the session has expired.");
      return;
    }

    setErrorMsg("");
    setConfirmingMsg("");
    setTxHash(null);
    setBridgeTxHash(null);
    setProgress("Checking balances...");
    setStep("idle");

    try {
      const requiredAmount = amountToUsdcSubunits(intent.amountUSDC);
      const arcBalance = await readArcUsdcBalance(walletAddress);

      if (arcBalance >= requiredAmount) {
        await executeExistingUnlock();
        return;
      }

      const sourceBalance = await findSupportedSourceBalance(requiredAmount);
      if (!sourceBalance) {
        setProgress(null);
        setStep("error");
        setErrorMsg(
          `You don't have enough Arc USDC. Add ${intent.amountUSDC.toFixed(2)} USDC on ${cctpDestinationChain.name} or connect a supported source wallet with USDC.`,
        );
        return;
      }

      const quote = await getCctpQuote({
        sourceKey: sourceBalance.sourceKey,
        amount: requiredAmount,
      });

      if (sourceBalance.balance < BigInt(quote.totalBurnAmount)) {
        setProgress(null);
        setStep("error");
        setErrorMsg(
          `You have ${sourceBalance.balanceUSDC.toFixed(2)} USDC on ${sourceBalance.chainName}. CCTP requires ${quote.totalBurnUSDC.toFixed(2)} USDC including forwarding fees.`,
        );
        return;
      }

      setBridgePrompt({
        sourceBalance,
        quote,
        amountUSDC: intent.amountUSDC,
      });
      setProgress(null);
    } catch (err: unknown) {
      setProgress(null);
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Balance check failed.");
    }
  }

  async function handleConfirmBridge() {
    if (!bridgePrompt) {
      return;
    }

    setBridgeBusy(true);
    setStep("paying");
    setErrorMsg("");
    setBridgeTxHash(null);
    setProgress("Preparing bridge...");

    let bridge: CctpBridgeExecution | null = null;
    let sourceTxHash: Hash | null = null;

    try {
      bridge = await executeCctpBridge({
        sourceWallet: bridgePrompt.sourceBalance.wallet,
        destinationAddress: walletAddress as Address,
        amountUSDC: bridgePrompt.amountUSDC,
        quote: bridgePrompt.quote,
        onSourceTx: async (hash) => {
          sourceTxHash = hash;
          await postCctpBridgeEvent(
            {
              event: "started",
              resourceId: intent.resource.id,
              payerWallet: walletAddress,
              sourceWallet: bridgePrompt.sourceBalance.wallet,
              sourceChain: {
                name: bridgePrompt.quote.sourceChain.name,
                chainId: bridgePrompt.quote.sourceChain.chainId,
                domain: bridgePrompt.quote.sourceChain.domain,
              },
              destinationChain: {
                name: bridgePrompt.quote.destinationChain.name,
                chainId: bridgePrompt.quote.destinationChain.chainId,
                domain: bridgePrompt.quote.destinationChain.domain,
              },
              amountUSDC: bridgePrompt.amountUSDC,
              feeUSDC: bridgePrompt.quote.feeUSDC,
              totalBurnUSDC: bridgePrompt.quote.totalBurnUSDC,
              sourceTxHash: hash,
            },
            { wallet: walletAddress },
          );
        },
        onStep: (bridgeStep) => {
          if (bridgeStep === "preparing" || bridgeStep === "approving") {
            setProgress("Preparing bridge...");
          }

          if (bridgeStep === "bridging") {
            setProgress("Bridging USDC...");
          }

          if (bridgeStep === "receiving") {
            setProgress("USDC received on Arc...");
          }
        },
      });
      setBridgeTxHash(bridge.destinationTxHash);

      await postCctpBridgeEvent(
        {
          event: "completed",
          sourceTxHash: bridge.sourceTxHash,
          destinationTxHash: bridge.destinationTxHash,
          payerWallet: walletAddress,
        },
        { wallet: walletAddress },
      );

      setBridgePrompt(null);
      setProgress("USDC received on Arc...");
      await waitForArcBalance(amountToUsdcSubunits(intent.amountUSDC));
      await executeExistingUnlock();
    } catch (err: unknown) {
      setProgress(null);
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Bridge failed.");

      if (sourceTxHash ?? bridge?.sourceTxHash) {
        await postCctpBridgeEvent(
          {
            event: "failed",
            sourceTxHash: sourceTxHash ?? bridge?.sourceTxHash ?? "",
            payerWallet: walletAddress,
            errorMessage: err instanceof Error ? err.message : "Bridge failed.",
          },
          { wallet: walletAddress },
        ).catch(() => undefined);
      }
    } finally {
      setBridgeBusy(false);
    }
  }

  async function executeExistingUnlock() {
    if (!bundlerClient) {
      throw new Error("Active wallet session is not available.");
    }

    setStep("paying");
    setProgress("Unlocking resource...");

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
      setProgress("Unlocking resource...");
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
        setProgress("Complete");
        onUnlocked(result.resource, result.txHash);
        return;
      }

      if (result.verification?.status === "CONFIRMING") {
        setProgress(null);
        setStep("confirming");
        setConfirmingMsg(
          result.verification.reason ??
            "Payment is being confirmed on-chain. This may take a few moments.",
        );
        return;
      }

      if (result.verification?.status === "FAILED") {
        setProgress(null);
        setStep("error");
        setErrorMsg("Payment verification failed. Check that the transaction settled correctly.");
        return;
      }

      setProgress(null);
      setStep("error");
      setErrorMsg("Unexpected response from verification. Try again.");
    } catch (err: unknown) {
      setProgress(null);
      setStep("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Payment or verification failed.",
      );
    }
  }

  async function waitForArcBalance(requiredAmount: bigint) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const balance = await readArcUsdcBalance(walletAddress);
      if (balance >= requiredAmount) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }

    throw new Error("Bridge completed but Arc USDC balance was not observed.");
  }

  const isLoading = step === "paying" || step === "verifying" || bridgeBusy;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={headerStyle}>
        <span style={headerLabelStyle}>Payment required</span>
        <span style={headerChainStyle}>Arc USDC</span>
      </div>

      <div style={receiptStyle}>
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
        <div style={infoBoxStyle}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Unlock checks Arc USDC first. If needed, Circle CCTP brings native
            USDC to Arc, then the existing split payment executes for exactly{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
              {intent.amountUSDC.toFixed(2)} USDC
            </span>{" "}
            and grants access automatically.
          </p>
        </div>
      )}

      {progress && (
        <div style={progressBoxStyle}>
          <p style={progressTitleStyle}>{progress}</p>
          <ProgressList active={progress} />
        </div>
      )}

      {bridgePrompt && (
        <div style={bridgePromptStyle}>
          <p style={bridgeTitleStyle}>You don't have enough Arc USDC.</p>
          <p style={bridgeBodyStyle}>
            Bridge {bridgePrompt.amountUSDC.toFixed(2)} USDC from{" "}
            {bridgePrompt.quote.sourceChain.name} to{" "}
            {bridgePrompt.quote.destinationChain.name} using Circle CCTP?
          </p>
          <div style={bridgeDetailsStyle}>
            <ReceiptLine label="SOURCE" value={bridgePrompt.quote.sourceChain.name} />
            <ReceiptLine label="DESTINATION" value={bridgePrompt.quote.destinationChain.name} />
            <ReceiptLine label="AMOUNT" value={`${bridgePrompt.amountUSDC.toFixed(2)} USDC`} accent />
            <ReceiptLine
              label="ESTIMATE"
              value={bridgePrompt.quote.estimatedCompletion}
            />
            <ReceiptLine
              label="SOURCE BALANCE"
              value={`${Number(formatUnits(bridgePrompt.sourceBalance.balance, 6)).toFixed(2)} USDC`}
            />
          </div>
          <div style={bridgeActionRowStyle}>
            <button
              type="button"
              onClick={handleConfirmBridge}
              disabled={bridgeBusy}
              style={{
                ...primaryActionStyle,
                background: bridgeBusy ? "var(--border)" : "var(--accent)",
                color: bridgeBusy ? "var(--text-muted)" : "#000",
                cursor: bridgeBusy ? "not-allowed" : "pointer",
              }}
            >
              {bridgeBusy ? "Bridging..." : "Bridge and unlock"}
            </button>
            <button
              type="button"
              onClick={() => setBridgePrompt(null)}
              disabled={bridgeBusy}
              style={secondaryActionStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "confirming" && (
        <div style={confirmingBoxStyle}>
          <p style={confirmingTitleStyle}>Confirming - {confirmingMsg}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            Your payment was submitted. Access will be granted once Arc verification reports
            final settlement.
          </p>
        </div>
      )}

      {step !== "confirming" && (
        <div style={{ padding: "16px 20px" }}>
          {bridgeTxHash && <HashBlock label="Bridge transaction" hash={bridgeTxHash} />}
          {txHash && <HashBlock label="Transaction hash" hash={txHash} />}

          {errorMsg && (
            <p style={errorStyle}>
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
              ? progress ?? "Executing USDC payment..."
              : step === "verifying"
                ? "Verifying settlement..."
                : "Pay and unlock"}
          </button>
        </div>
      )}
    </div>
  );
}

function HashBlock({ label, hash }: { label: string; hash: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={hashLabelStyle}>{label}</p>
      <p style={hashValueStyle}>{hash}</p>
    </div>
  );
}

function ProgressList({ active }: { active: ProgressStep }) {
  const steps: ProgressStep[] = [
    "Checking balances...",
    "Preparing bridge...",
    "Bridging USDC...",
    "USDC received on Arc...",
    "Unlocking resource...",
    "Complete",
  ];
  const activeIndex = steps.indexOf(active);

  return (
    <div style={progressListStyle}>
      {steps.map((step, index) => (
        <div key={step} style={progressItemStyle}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background:
                index <= activeIndex ? "var(--accent)" : "var(--border)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color:
                index <= activeIndex
                  ? "var(--text-secondary)"
                  : "var(--text-muted)",
            }}
          >
            {step}
          </span>
        </div>
      ))}
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
    <div style={receiptLineStyle}>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</span>
      <span
        style={{
          color: accent ? "var(--accent)" : "var(--text-primary)",
          fontSize: accent ? 16 : 13,
          fontWeight: accent ? 500 : 400,
          wordBreak: "break-word",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const headerStyle = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
} as const;

const headerLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const headerChainStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
} as const;

const receiptStyle = {
  padding: "20px",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
} as const;

const receiptLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 16,
  marginBottom: 8,
} as const;

const infoBoxStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border)",
  background: "var(--accent-dim)",
} as const;

const progressBoxStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(0,194,168,0.06)",
} as const;

const progressTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--accent)",
  marginBottom: 10,
} as const;

const progressListStyle = {
  display: "grid",
  gap: 7,
} as const;

const progressItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  lineHeight: 1.4,
} as const;

const bridgePromptStyle = {
  padding: "18px 20px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(200,151,42,0.08)",
} as const;

const bridgeTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--warning)",
  marginBottom: 8,
} as const;

const bridgeBodyStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: 14,
} as const;

const bridgeDetailsStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
} as const;

const bridgeActionRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
} as const;

const primaryActionStyle = {
  padding: "10px",
  border: "none",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font-mono)",
} as const;

const secondaryActionStyle = {
  padding: "10px 12px",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
} as const;

const confirmingBoxStyle = {
  padding: "20px",
  borderBottom: "1px solid var(--border)",
  background: "#c8972a10",
} as const;

const confirmingTitleStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--warning)",
  lineHeight: 1.6,
} as const;

const hashLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
} as const;

const hashValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
} as const;

const errorStyle = {
  fontSize: 12,
  color: "var(--error)",
  marginBottom: 12,
  lineHeight: 1.5,
} as const;
