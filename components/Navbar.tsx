"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { WalletGateLink } from "@/components/WalletGateLink";
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
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "var(--accent)" }}>AccessMesh</span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginLeft: "auto",
          }}
        >
          <Link href="/explore" style={navLinkStyle}>
            Explore
          </Link>
          <WalletGateLink href="/dashboard" style={navLinkStyle}>
            Dashboard
          </WalletGateLink>
          <Link href="/wallet" style={navLinkStyle}>
            Wallet
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={navLinkStyle}
          >
            GitHub
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {connected && address ? (
            <>
              <Link
                href="/dashboard"
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
                  textDecoration: "none",
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
              </Link>
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
              href="/wallet"
              style={{
                fontSize: 13,
                background: "var(--accent)",
                color: "#000",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                padding: "6px 14px",
                textDecoration: "none",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Connect Wallet
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

const navLinkStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  textDecoration: "none",
  padding: "4px 0",
  whiteSpace: "nowrap",
} satisfies CSSProperties;
