"use client";

import type { LedgerEntry } from "@/types";
import { formatDate, normaliseStatus, shortAddress } from "@/lib/ui";

const STATUS_COLORS: Record<string, string> = {
  unlocked: "var(--success)",
  payment_confirmed: "var(--success)",
  payment_initiated: "var(--accent)",
  payment_submitted: "var(--accent)",
  payment_verification_unavailable: "var(--warning)",
  payment_failed: "var(--error)",
  blocked: "var(--error)",
};

function getStatusColor(raw: string) {
  const key = raw.toLowerCase();
  return STATUS_COLORS[key] ?? "var(--text-muted)";
}

type Props = {
  entries: LedgerEntry[];
};

export function LedgerTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          No activity recorded for this wallet.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 180px 140px",
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          gap: 12,
        }}
      >
        {["Resource", "Status", "Tx Hash", "Date"].map((h) => (
          <span
            key={h}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 180px 140px",
              padding: "12px 20px",
              gap: 12,
              borderBottom:
                i < entries.length - 1 ? "1px solid var(--border-subtle)" : "none",
              alignItems: "center",
            }}
          >
            {/* Resource */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shortAddress(entry.resourceId)}
            </span>

            {/* Status */}
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: getStatusColor(entry.status),
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: getStatusColor(entry.status),
                  flexShrink: 0,
                }}
              />
              {normaliseStatus(entry.status)}
            </span>

            {/* Tx Hash */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.txHash ? shortAddress(entry.txHash) : "—"}
            </span>

            {/* Date */}
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {formatDate(entry.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}