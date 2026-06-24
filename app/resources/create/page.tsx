"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/ui/WalletContext";

export default function CreateResourcePage() {
  const { connected, address } = useWallet();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "44px 24px 80px" }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 10,
          }}
        >
          Create resource
        </p>
        <h1 style={{ fontSize: 28, color: "var(--text-primary)", marginBottom: 12 }}>
          Publish premium access
        </h1>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 24,
          }}
        >
          {connected && address ? (
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              Resource creation API is available for authenticated creators.
              Use the existing backend endpoint to publish resources for{" "}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                {address}
              </span>
              .
            </p>
          ) : (
            <>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Connect a wallet before creating resources.
              </p>
              <Link
                href="/wallet?next=/resources/create"
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  background: "var(--accent)",
                  color: "#000",
                  borderRadius: 4,
                  padding: "9px 13px",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Connect Wallet
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
