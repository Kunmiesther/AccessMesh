"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AccessCard } from "@/components/AccessCard";
import { PaymentIntentBox } from "@/components/PaymentIntentBox";
import { UnlockStatusTracker } from "@/components/UnlockStatusTracker";
import { useWallet } from "@/lib/ui/WalletContext";
import { getAccessIntent } from "@/lib/api";
import type { PaymentIntent, ResourceMeta } from "@/types";

const ACCESS_INTENT_TIMEOUT_MS = 30_000;

type PageState =
  | { phase: "no-wallet" }
  | { phase: "idle" }
  | { phase: "loading-intent" }
  | { phase: "ready"; intent: PaymentIntent }
  | {
      phase: "unlocked";
      resource: ResourceMeta;
      txHash: string;
    }
  | { phase: "error"; message: string };

export default function AccessPage() {
  const { id } = useParams<{ id: string }>();
  const { address, connected, ready, smartAccount, bundlerClient } = useWallet();
  const [state, setState] = useState<PageState>({ phase: "no-wallet" });

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!connected || !address) {
      setState({ phase: "no-wallet" });
      return;
    }

    setState({ phase: "idle" });
  }, [id, address, connected, ready]);

  async function handleUnlockClick() {
    if (!address) {
      setState({ phase: "no-wallet" });
      return;
    }

    setState({ phase: "loading-intent" });

    try {
      const res = await withTimeout(
        getAccessIntent(id, address),
        ACCESS_INTENT_TIMEOUT_MS,
        "access intent",
      );
      if (res.ok) {
        setState({ phase: "ready", intent: res.paymentIntent });
      } else {
        setState({ phase: "error", message: "Failed to load access intent." });
      }
    } catch (err) {
      setState({
        phase: "error",
        message:
          err instanceof Error ? err.message : "Failed to load access intent.",
      });
    }
  }

  function handleUnlocked(resource: ResourceMeta, txHash: string) {
    setState({ phase: "unlocked", resource, txHash });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      {/* Page visual band */}
      <div
        style={{
          width: "100%",
          height: 200,
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src="/images/access-page-visual.jpg"
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(10,10,10,0.3), var(--bg))",
          }}
        />
      </div>

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* Breadcrumb */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            AccessMesh
          </Link>
          <span>/</span>
          <span>access</span>
          <span>/</span>
          <span style={{ color: "var(--text-secondary)" }}>{id}</span>
        </div>

        {!ready && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              Restoring authenticated wallet...
            </p>
          </div>
        )}

        {/* No wallet */}
        {ready && state.phase === "no-wallet" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 12,
              }}
            >
              Wallet required
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Connect a wallet using the button in the top right before
              unlocking this resource.
            </p>
          </div>
        )}

        {/* Idle */}
        {ready && state.phase === "idle" && address && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "32px 24px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Resource
            </p>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
                wordBreak: "break-word",
              }}
            >
              {id}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              Unlocking will request a payment intent for your connected wallet.
            </p>
            <button
              type="button"
              onClick={handleUnlockClick}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--accent)",
                color: "#000",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              Unlock
            </button>
          </div>
        )}

        {/* Loading */}
        {ready && state.phase === "loading-intent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton height={280} />
            <Skeleton height={280} />
          </div>
        )}

        {/* Error */}
        {ready && state.phase === "error" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid #e0525230",
              borderRadius: 8,
              padding: "24px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--error)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Error
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                fontSize: 12,
                color: "var(--text-secondary)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Ready */}
        {ready && state.phase === "ready" && address && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AccessCard
              resource={state.intent.resource}
              amountUSDC={state.intent.amountUSDC}
              recipientWallet={state.intent.recipientWallet}
              expiresAt={state.intent.expiresAt}
            />
            <PaymentIntentBox
              intent={state.intent}
              walletAddress={address}
              smartAccount={smartAccount}
              bundlerClient={bundlerClient}
              onUnlocked={handleUnlocked}
            />
          </div>
        )}

        {/* Unlocked */}
        {ready && state.phase === "unlocked" && (
          <UnlockStatusTracker
            resource={state.resource}
            txHash={state.txHash}
          />
        )}
      </main>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        animation: "shimmer 1.4s ease infinite",
        backgroundImage:
          "linear-gradient(90deg, var(--surface) 25%, #1a1a1a 50%, var(--surface) 75%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
