"use client";

import { useState } from "react";
import { formatUnits, type Address, type Hash } from "viem";
import { postCctpBridgeEvent, postUnlock } from "@/lib/api";
import {
  amountToUsdcSubunits,
  executeCctpBridge,
  getCctpQuote,
  getSourceBridgeState,
  readArcUsdcBalance,
  type CctpBridgeExecution,
  type CctpQuote,
  type SourceBridgeState,
} from "@/lib/cctp-client";
import { cctpDestinationChain } from "@/lib/cctp-config";
import type { ModularWalletSession } from "@/lib/modular-wallet";
import {
  confirmUsdcPayment,
  submitUsdcPayment,
} from "@/lib/usdc-transfer";
import type { PaymentIntent } from "@/types";

type Props = {
  intent: PaymentIntent;
  walletAddress: Address;
  smartAccount: ModularWalletSession["smartAccount"] | null;
  bundlerClient: ModularWalletSession["bundlerClient"] | null;
  onUnlocked: (resource: PaymentIntent["resource"], txHash: string) => void;
};

type Step = "idle" | "paying" | "verifying" | "confirming" | "error";

const DIRECT_UNLOCK_STEPS = [
  "Checking balances...",
  "Arc USDC detected.",
  "Unlocking resource...",
  "Complete.",
] as const;

const BRIDGED_UNLOCK_STEPS = [
  "Checking balances...",
  "Preparing bridge...",
  "Bridging USDC...",
  "Waiting for Circle attestation...",
  "USDC received on Arc...",
  "Unlocking resource...",
  "Complete.",
] as const;

type DirectUnlockStep = (typeof DIRECT_UNLOCK_STEPS)[number];
type BridgedUnlockStep = (typeof BRIDGED_UNLOCK_STEPS)[number];
type ProgressState =
  | { flow: "direct"; step: DirectUnlockStep }
  | { flow: "bridge"; step: BridgedUnlockStep };

type ProgressFlow = ProgressState["flow"];

type BridgePrompt = {
  sourceBalance: SourceBridgeState;
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
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<Hash | null>(null);
  const [pendingPaymentUserOpHash, setPendingPaymentUserOpHash] = useState<Hash | null>(null);
  const [pendingUnlockFlow, setPendingUnlockFlow] = useState<ProgressFlow | null>(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmingMsg, setConfirmingMsg] = useState("");

  async function handleUnlock() {
    setBridgePrompt(null);
    setPendingPaymentUserOpHash(null);
    setPendingUnlockFlow(null);
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
    setDirectProgress("Checking balances...");
    setStep("idle");

    try {
      const requiredAmount = getRequiredUnlockAmount(intent);
      const requiredAmountUSDC = usdcSubunitsToAmount(requiredAmount);
      const arcBalance = await readArcUsdcBalance(walletAddress);

      if (arcBalance >= requiredAmount) {
        setDirectProgress("Arc USDC detected.");
        await executeExistingUnlock("direct");
        return;
      }

      const sourceBalance = await getSourceBridgeState(requiredAmount);
      if (!sourceBalance) {
        setProgress(null);
        setStep("error");
        setErrorMsg(
          `You don't have enough Arc USDC. Add ${requiredAmountUSDC.toFixed(2)} USDC on ${cctpDestinationChain.name} or connect a supported source wallet with USDC.`,
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
        amountUSDC: requiredAmountUSDC,
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
    setStep("idle");
    setErrorMsg("");
    setBridgeTxHash(null);
    setBridgeProgress("Checking balances...");

    let bridge: CctpBridgeExecution | null = null;
    let sourceTxHash: Hash | null = null;

    try {
      const requiredAmount = getRequiredUnlockAmount(intent);
      setBridgeProgress("Preparing bridge...");
      bridge = await executeCctpBridge({
        sourceKey: bridgePrompt.sourceBalance.sourceKey,
        sourceWallet: bridgePrompt.sourceBalance.wallet,
        destinationAddress: walletAddress,
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
            setBridgeProgress("Preparing bridge...");
          }

          if (bridgeStep === "bridging") {
            setBridgeProgress("Bridging USDC...");
          }

          if (bridgeStep === "receiving") {
            setBridgeProgress("Waiting for Circle attestation...");
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
      setBridgeProgress("USDC received on Arc...");
      await waitForArcBalance(requiredAmount);
      await executeExistingUnlock("bridge");
    } catch (err: unknown) {
      setProgress(null);
      setStep("error");
      setErrorMsg(getBridgeErrorMessage(err));

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

  async function executeExistingUnlock(flow: ProgressFlow) {
    if (!bundlerClient) {
      throw new Error("Active wallet session is not available.");
    }

    setPendingUnlockFlow(flow);
    setStep("paying");
    setUnlockingProgress(flow);

    try {
      const userOpHash = await submitUsdcPayment({
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
      setPendingPaymentUserOpHash(userOpHash);

      const confirmation = await confirmUsdcPayment({
        bundlerClient,
        userOpHash,
      });

      if (confirmation.status === "pending") {
        setProgress(null);
        setStep("confirming");
        setConfirmingMsg("Transaction is taking longer than expected.");
        return;
      }

      await settleUnlockAfterPayment(flow, confirmation.transactionHash);
    } catch (err: unknown) {
      setProgress(null);
      setStep("confirming");
      setPendingPaymentUserOpHash(null);
      setPendingUnlockFlow(null);
      setConfirmingMsg(
        err instanceof Error ? err.message : "Payment or verification failed.",
      );
    }
  }

  async function handleCheckPaymentStatus() {
    if (!bundlerClient || !pendingPaymentUserOpHash || !pendingUnlockFlow) {
      return;
    }

    setCheckingPaymentStatus(true);
    try {
      const confirmation = await confirmUsdcPayment({
        bundlerClient,
        userOpHash: pendingPaymentUserOpHash,
      });

      if (confirmation.status === "pending") {
        setProgress(null);
        setStep("confirming");
        setConfirmingMsg("Transaction is taking longer than expected.");
        return;
      }

      await settleUnlockAfterPayment(
        pendingUnlockFlow,
        confirmation.transactionHash,
      );
    } catch (err: unknown) {
      setProgress(null);
      setStep("confirming");
      setConfirmingMsg(
        err instanceof Error ? err.message : "Payment or verification failed.",
      );
    } finally {
      setCheckingPaymentStatus(false);
    }
  }

  async function settleUnlockAfterPayment(flow: ProgressFlow, txHash: Hash) {
    setTxHash(txHash);
    setStep("verifying");
    setUnlockingProgress(flow);

    const result = await postUnlock(
      {
        accessId: intent.accessId,
        txHash,
      },
      {
        wallet: walletAddress,
      },
    );

    if (result.ok) {
      setPendingPaymentUserOpHash(null);
      setPendingUnlockFlow(null);
      setCompleteProgress(flow);
      onUnlocked(result.resource, result.txHash);
      return;
    }

    if (result.verification?.status === "CONFIRMING") {
      setProgress(null);
      setStep("confirming");
      setPendingPaymentUserOpHash(null);
      setPendingUnlockFlow(null);
      setConfirmingMsg(
        result.verification.reason ??
          "Payment is being confirmed on-chain. This may take a few moments.",
      );
      return;
    }

    if (result.verification?.status === "FAILED") {
      setProgress(null);
      setStep("error");
      setPendingPaymentUserOpHash(null);
      setPendingUnlockFlow(null);
      setErrorMsg("Payment verification failed. Check that the transaction settled correctly.");
      return;
    }

    setProgress(null);
    setStep("error");
    setPendingPaymentUserOpHash(null);
    setPendingUnlockFlow(null);
    setErrorMsg("Unexpected response from verification. Try again.");
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

  function setDirectProgress(step: DirectUnlockStep) {
    setProgress({ flow: "direct", step });
  }

  function setBridgeProgress(step: BridgedUnlockStep) {
    setProgress({ flow: "bridge", step });
  }

  function setUnlockingProgress(flow: ProgressFlow) {
    if (flow === "direct") {
      setDirectProgress("Unlocking resource...");
      return;
    }

    setBridgeProgress("Unlocking resource...");
  }

  function setCompleteProgress(flow: ProgressFlow) {
    if (flow === "direct") {
      setDirectProgress("Complete.");
      return;
    }

    setBridgeProgress("Complete.");
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
          <p style={progressTitleStyle}>{progress.step}</p>
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
          <p style={confirmingTitleStyle}>{confirmingMsg}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            Your payment was submitted. Access will be granted once the transaction is confirmed.
          </p>
          {pendingPaymentUserOpHash && (
            <div style={{ marginTop: 12 }}>
              <HashBlock label="User operation" hash={pendingPaymentUserOpHash} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={handleCheckPaymentStatus}
              disabled={
                checkingPaymentStatus ||
                !pendingPaymentUserOpHash ||
                !pendingUnlockFlow
              }
              style={{
                width: "100%",
                padding: "10px",
                background:
                  checkingPaymentStatus ||
                  !pendingPaymentUserOpHash ||
                  !pendingUnlockFlow
                    ? "var(--border)"
                    : "var(--accent)",
                color:
                  checkingPaymentStatus ||
                  !pendingPaymentUserOpHash ||
                  !pendingUnlockFlow
                    ? "var(--text-muted)"
                    : "#000",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor:
                  checkingPaymentStatus ||
                  !pendingPaymentUserOpHash ||
                  !pendingUnlockFlow
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.02em",
              }}
            >
              {checkingPaymentStatus ? "Checking status..." : "Check status"}
            </button>
          </div>
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
              ? progress?.step ?? "Executing USDC payment..."
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

function ProgressList({ active }: { active: ProgressState }) {
  const steps = active.flow === "direct" ? DIRECT_UNLOCK_STEPS : BRIDGED_UNLOCK_STEPS;
  const activeIndex =
    active.flow === "direct"
      ? DIRECT_UNLOCK_STEPS.indexOf(active.step)
      : BRIDGED_UNLOCK_STEPS.indexOf(active.step);

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

function getRequiredUnlockAmount(intent: PaymentIntent) {
  return amountToUsdcSubunits(intent.creatorAmountUSDC + intent.treasuryAmountUSDC);
}

function usdcSubunitsToAmount(amount: bigint) {
  return Number(formatUnits(amount, 6));
}

function getBridgeErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : "Bridge failed.";

  if (/gas required exceeds allowance/i.test(message)) {
    return "The source wallet needs native gas to pay for the bridge transaction.";
  }

  return message;
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
