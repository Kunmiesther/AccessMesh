"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@/lib/ui/WalletContext";
import { shortAddress } from "@/lib/ui";

export function Navbar() {
  const { address, connected, connect, disconnect } = useWallet();
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  function handleConnect() {
    if (!inputValue.trim()) {
      setError("Enter a wallet address.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(inputValue.trim())) {
      setError("Invalid EVM address format.");
      return;
    }
    connect(inputValue.trim());
    setShowInput(false);
    setInputValue("");
    setError("");
  }

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
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-primary)",
            textDecoration: "none",
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--accent)" }}>◈</span>
          AccessMesh
        </Link>

        {/* Right side */}
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
                  transition: "color 0.15s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                Activity
              </Link>
              <button
                onClick={disconnect}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "5px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--error)";
                  e.currentTarget.style.color = "var(--error)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                {shortAddress(address)}
              </button>
            </>
          ) : showInput ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="0x..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    background: "var(--surface)",
                    border: `1px solid ${error ? "var(--error)" : "var(--border)"}`,
                    color: "var(--text-primary)",
                    borderRadius: 4,
                    padding: "5px 10px",
                    width: 280,
                    outline: "none",
                  }}
                />
                {error && (
                  <span
                    style={{ fontSize: 11, color: "var(--error)", paddingLeft: 2 }}
                  >
                    {error}
                  </span>
                )}
              </div>
              <button
                onClick={handleConnect}
                style={{
                  fontSize: 12,
                  background: "var(--accent)",
                  color: "#000",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "var(--accent-hover)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "var(--accent)")
                }
              >
                Connect
              </button>
              <button
                onClick={() => {
                  setShowInput(false);
                  setError("");
                }}
                style={{
                  fontSize: 12,
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px 4px",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              style={{
                fontSize: 13,
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "6px 14px",
                cursor: "pointer",
                transition: "border-color 0.15s, transform 0.1s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}