"use client";

import { useEffect, useState } from "react";

type Props = {
  address: string;
};

export function WalletCopyButton({ address }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
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
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
          ⧉
        </span>
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
