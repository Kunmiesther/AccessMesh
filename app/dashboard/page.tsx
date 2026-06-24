"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { LedgerTable } from "@/components/LedgerTable";
import { WalletCopyButton } from "@/components/WalletCopyButton";
import { useWallet } from "@/lib/ui/WalletContext";
import { formatDate, formatUSDC, shortAddress } from "@/lib/ui";
import { getLedger, getResources } from "@/lib/api";
import type { LedgerEntry, ResourceMeta } from "@/types";

type DashboardState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "done";
      ledger: LedgerEntry[];
      createdResources: ResourceMeta[];
    }
  | { status: "error"; message: string };

export default function DashboardPage() {
  const { address, connected } = useWallet();
  const [state, setState] = useState<DashboardState>({ status: "idle" });

  useEffect(() => {
    if (!connected || !address) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });

    Promise.all([
      getLedger({ wallet: address, limit: 200 }),
      getResources({ ownerWallet: address }),
    ])
      .then(([ledgerRes, resourceRes]) => {
        setState({
          status: "done",
          ledger: ledgerRes.ledger,
          createdResources: resourceRes.resources,
        });
      })
      .catch((error: Error) => {
        setState({ status: "error", message: error.message });
      });
  }, [address, connected]);

  const purchasedResources = useMemo(() => {
    if (state.status !== "done") return [];

    const unlocked = state.ledger.filter((entry) =>
      ["UNLOCKED", "ACCESS_GRANTED", "PAYMENT_CONFIRMED"].includes(entry.status),
    );

    return Array.from(
      new Map(unlocked.map((entry) => [entry.resourceId, entry])).values(),
    );
  }, [state]);

  const paymentHistory =
    state.status === "done"
      ? state.ledger.filter((entry) => entry.status.startsWith("PAYMENT_"))
      : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        <header style={{ marginBottom: 32 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Dashboard
          </p>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 10,
            }}
          >
            Wallet identity
          </h1>
          {connected && address ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "7px 10px",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
                Connected {shortAddress(address)}
              </div>
              <WalletCopyButton address={address} />
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Connect with a passkey to view wallet activity.
            </p>
          )}
        </header>

        {connected && address && (
          <nav
            aria-label="Dashboard navigation"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <DashboardNavLink href="/dashboard">Dashboard</DashboardNavLink>
            <DashboardNavLink href="/explore">Explore Resources</DashboardNavLink>
            <DashboardNavLink href="/resources/create">Create Resource</DashboardNavLink>
            <DashboardNavLink href="/wallet">Wallet</DashboardNavLink>
          </nav>
        )}

        {!connected && (
          <EmptyPanel
            title="No wallet connected"
            body="Return to the entry screen and continue with your passkey."
            actionHref="/"
            actionLabel="Connect wallet"
          />
        )}

        {connected && state.status === "loading" && (
          <Panel>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              Loading wallet activity...
            </p>
          </Panel>
        )}

        {connected && state.status === "error" && (
          <Panel>
            <p style={{ fontSize: 13, color: "var(--error)" }}>
              {state.message}
            </p>
          </Panel>
        )}

        {connected && state.status === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <section>
              <SectionHeader
                title="Purchased resources"
                detail={`${purchasedResources.length} resources`}
              />
              {purchasedResources.length > 0 ? (
                <ResourceIdList entries={purchasedResources} />
              ) : (
                <EmptyPanel
                  title="No purchases yet"
                  body="Unlocked resources will appear here after settlement verification."
                />
              )}
            </section>

            <section>
              <SectionHeader
                title="Created resources"
                detail={`${state.createdResources.length} resources`}
              />
              {state.createdResources.length > 0 ? (
                <CreatedResourceList resources={state.createdResources} />
              ) : (
                <EmptyPanel
                  title="No created resources"
                  body="Resources created by this wallet will appear here."
                />
              )}
            </section>

            <section>
              <SectionHeader
                title="Payment history"
                detail={`${paymentHistory.length} payment events`}
              />
              <LedgerTable entries={paymentHistory} />
            </section>

            <section>
              <SectionHeader
                title="Full ledger"
                detail={`${state.ledger.length} total events`}
              />
              <LedgerTable entries={state.ledger} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 12,
        color: "var(--text-secondary)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "7px 10px",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function SectionHeader({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        {detail}
      </span>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "24px",
      }}
    >
      {children}
    </div>
  );
}

function EmptyPanel({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Panel>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {body}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          style={{
            display: "inline-block",
            marginTop: 14,
            fontSize: 12,
            color: "#000",
            background: "var(--accent)",
            borderRadius: 4,
            padding: "7px 12px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {actionLabel}
        </Link>
      )}
    </Panel>
  );
}

function ResourceIdList({ entries }: { entries: LedgerEntry[] }) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entries.map((entry) => (
          <div
            key={entry.resourceId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <Link
              href={`/access/${entry.resourceId}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              {entry.resourceId}
            </Link>
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
    </Panel>
  );
}

function CreatedResourceList({ resources }: { resources: ResourceMeta[] }) {
  return (
    <Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {resources.map((resource) => (
          <div
            key={resource.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {resource.name}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {resource.type} / {shortAddress(resource.id)}
              </p>
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--accent)",
              }}
            >
              {formatUSDC(resource.priceUSDC ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
