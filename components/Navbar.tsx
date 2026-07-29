"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { WalletGateLink } from "@/components/WalletGateLink";
import { useWallet } from "@/lib/ui/WalletContext";
import { shortAddress } from "@/lib/ui";

export function Navbar() {
  const { address, connected, ready, disconnect } = useWallet();
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      try {
        const [approvalResponse, notificationResponse] = await Promise.all([
          fetch("/api/agent/approvals?limit=1&status=pending"),
          fetch("/api/agent/notifications/unread-count"),
        ]);

        if (!cancelled && approvalResponse.ok) {
          const payload = (await approvalResponse.json().catch(() => null)) as
            | { pendingCount?: number }
            | null;
          if (payload && typeof payload.pendingCount === "number") {
            setPendingApprovals(payload.pendingCount);
          }
        }

        if (!cancelled && notificationResponse.ok) {
          const payload = (await notificationResponse.json().catch(() => null)) as
            | { count?: number }
            | null;
          if (payload && typeof payload.count === "number") {
            setUnreadNotifications(payload.count);
          }
        }
      } catch {
        if (!cancelled) {
          setPendingApprovals(null);
          setUnreadNotifications(null);
        }
      }
    }

    void loadCounts();

    return () => {
      cancelled = true;
    };
  }, [connected, address, ready]);

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
        className="navbar-shell"
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

        <div className="navbar-links">
          <Link href="/explore" style={navLinkStyle}>
            Explore
          </Link>
          <Link href="/agent" style={navLinkStyle}>
            Research Agent
          </Link>
          <Link href="/agent/history" style={navLinkStyle}>
            History
            {pendingApprovals && pendingApprovals > 0 ? <Badge count={pendingApprovals} /> : null}
          </Link>
          <Link href="/agent/inbox" style={navLinkStyle}>
            Inbox
            {pendingApprovals && pendingApprovals > 0 ? <Badge count={pendingApprovals} /> : null}
          </Link>
          <Link href="/agent/analytics" style={navLinkStyle}>
            Analytics
          </Link>
          <Link href="/agent/policies" style={navLinkStyle}>
            Policies
          </Link>
          <Link href="/agent/budgets" style={navLinkStyle}>
            Budgets
          </Link>
          <Link href="/agent/notifications" style={navLinkStyle}>
            Notifications
            {unreadNotifications && unreadNotifications > 0 ? <Badge count={unreadNotifications} /> : null}
          </Link>
          <Link href="/create" style={navLinkStyle}>
            Create
          </Link>
          <WalletGateLink href="/dashboard" style={navLinkStyle}>
            Dashboard
          </WalletGateLink>
          <Link href="/wallet" style={navLinkStyle}>
            Wallet
          </Link>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            style={navLinkStyle}
          >
            Get Test USDC
          </a>
        </div>

        <div className="navbar-wallet">
          {!ready ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "5px 10px",
              }}
            >
              Restoring wallet...
            </span>
          ) : connected && address ? (
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
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
} satisfies CSSProperties;

function Badge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count > 9 ? "9+" : count} unread`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--accent)",
        background: "rgba(0,194,168,0.08)",
        border: "1px solid rgba(0,194,168,0.25)",
        borderRadius: 999,
        padding: "2px 6px",
        lineHeight: 1,
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
