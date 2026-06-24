"use client";

import Link from "next/link";
import { useWallet } from "@/lib/ui/WalletContext";
import { shortAddress } from "@/lib/ui";

export function Navbar() {
  const { address, connected, disconnect } = useWallet();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-primary)",
            textDecoration: "none",
            letterSpacing: "0",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--accent)" }}>●</span>
          AccessMesh
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {connected && address ? (
            <>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  padding: "4px 10px",
                  borderRadius: 4,
                }}
              >
                Dashboard
              </Link>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                {shortAddress(address)}
              </div>
              <button
                type="button"
                onClick={disconnect}
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <Link
              href="/"
              style={{
                fontSize: 13,
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "6px 14px",
                textDecoration: "none",
              }}
            >
              Connect wallet
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
