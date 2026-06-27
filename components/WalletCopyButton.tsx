"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Props = {
  address: string;
  buttonStyle?: CSSProperties;
};

export function WalletCopyButton({ address, buttonStyle }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={copyAddress}
        title="Copy wallet address"
        aria-label="Copy wallet address"
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          cursor: "pointer",
          ...buttonStyle,
        }}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
        >
          <rect
            x="5.25"
            y="5.25"
            width="7.5"
            height="7.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3.25 10.25V4.75C3.25 3.92 3.92 3.25 4.75 3.25H10.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {copied && (
        <span
          role="status"
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            whiteSpace: "nowrap",
            fontSize: 12,
            color: "#000",
            background: "var(--accent)",
            borderRadius: 4,
            padding: "6px 9px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            zIndex: 10,
          }}
        >
          Address copied
        </span>
      )}
    </span>
  );
}
