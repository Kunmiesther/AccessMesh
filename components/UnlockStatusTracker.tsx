"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResourceMeta } from "@/types";
import { arcExplorerTxUrl } from "@/lib/ui";

type Props = {
  resource: ResourceMeta;
  txHash: string;
};

export function UnlockStatusTracker({ resource, txHash }: Props) {
  const [copied, setCopied] = useState(false);
  const resourceUrl = `/resource/${resource.id}`;
  const explorerUrl = arcExplorerTxUrl(txHash);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyResourceLink() {
    const absoluteUrl = new URL(resourceUrl, window.location.origin).toString();
    try {
      await window.navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", absoluteUrl);
    }
  }

  function shareOnX() {
    const absoluteUrl = new URL(resourceUrl, window.location.origin).toString();
    const text = encodeURIComponent(
      `Unlocked "${resource.title || resource.name}" on AccessMesh.`,
    );
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(absoluteUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid #4caf7d30",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #4caf7d30",
          background: "#4caf7d0d",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--success)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--success)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Access confirmed
          </span>
        </div>
        <Link href={`/resource/${resource.id}`} style={primaryLinkStyle}>
          Open Resource
        </Link>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: 16 }}>
          <p style={labelStyle}>Resource</p>
          <h2 style={titleStyle}>{resource.title || resource.name}</h2>
          <p style={bodyStyle}>{resource.description}</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={labelStyle}>Transaction</p>
          <a href={explorerUrl} target="_blank" rel="noreferrer" style={txLinkStyle}>
            {txHash}
          </a>
          <div style={actionRowStyle}>
            <a href={explorerUrl} target="_blank" rel="noreferrer" style={secondaryButtonStyle}>
              View on Arc Explorer
            </a>
            <button type="button" onClick={copyResourceLink} style={secondaryButtonStyle}>
              {copied ? "Link copied" : "Copy resource link"}
            </button>
            <button type="button" onClick={shareOnX} style={secondaryButtonStyle}>
              Share on X
            </button>
          </div>
        </div>

        <div style={metaGridStyle}>
          <MetaItem label="Creator" value={resource.creatorDisplayName ?? resource.creatorWallet} />
          <MetaItem label="Category" value={resource.resourceCategory ?? resource.category} />
          <MetaItem label="Price" value={`${resource.priceUSDC.toFixed(2)} USDC`} />
          <MetaItem label="Unlocks" value={String(resource.unlockCount)} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
    </div>
  );
}

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 12,
} as const;

const actionRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
} as const;

const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
} as const;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
} as const;

const metaItemStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 8,
  padding: 14,
  minWidth: 0,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 7,
} as const;

const metaValueStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
} as const;

const titleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
  marginBottom: 10,
} as const;

const bodyStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  marginBottom: 0,
} as const;

const txLinkStyle = {
  display: "inline-block",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--accent)",
  textDecoration: "none",
  wordBreak: "break-all",
  marginBottom: 8,
} as const;
