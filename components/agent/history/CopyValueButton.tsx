"use client";

import { useState } from "react";

export function CopyValueButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt(label, value);
    }
  }

  return (
    <button type="button" onClick={handleCopy} style={buttonStyle}>
      {copied ? "Copied" : label}
    </button>
  );
}

const buttonStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "6px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
} as const;
