"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LedgerTable } from "@/components/LedgerTable";
import { useWallet } from "@/lib/ui/WalletContext";
import { getLedger } from "@/lib/api";
import { shortAddress } from "@/lib/ui";
import type { LedgerEntry } from "@/types";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; entries: LedgerEntry[] }
  | { status: "error"; message: string };

export default function DashboardPage() {
  const { address, connected } = useWallet();
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [resourceFilter, setResourceFilter] = useState("");

  useEffect(() => {
    if (!connected || !address) {
      setFetchState({ status: "idle" });
      return;
    }

    setFetchState({ status: "loading" });

    getLedger({ wallet: address, limit: 200 })
      .then((res) => {
        if (res.ok) {
          setFetchState({ status: "done", entries: res.ledger });
        } else {
          setFetchState({ status: "error", message: "Could not load ledger." });
        }
      })
      .catch((err: Error) => {
        setFetchState({ status: "error", message: err.message });
      });
  }, [address, connected]);

  const filteredEntries =
    fetchState.status === "done"
      ? resourceFilter.trim()
        ? fetchState.entries.filter((e) =>
            e.resourceId.includes(resourceFilter.trim()),
          )
        : fetchState.entries
      : [];

  const unlockedCount =
    fetchState.status === "done"
      ? fetchState.entries.filter((e) => e.status === "UNLOCKED").length
      : 0;

  const totalEntries =
    fetchState.status === "done" ? fetchState.entries.length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      {/* Dashboard hero visual */}
      <div
        style={{
          width: "100%",
          height: 200,
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src="/images/dashboard-visual.jpg"
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(10,10,10,0.2), var(--bg))",
          }}
        />
      </div>

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* Page header */}
        <div
          style={{
            marginBottom: 40,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
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
              Activity
            </p>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Your access history
            </h1>
            {connected && address && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                {shortAddress(address)}
              </p>
            )}
          </div>

          {/* Stat cards */}
          {fetchState.status === "done" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {/* Unlocked stat */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  overflow: "hidden",
                  minWidth: 140,
                  position: "relative",
                }}
              >
                <img
                  src="/images/stat-unlocked.jpg"
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.18,
                    display: "block",
                  }}
                />
                <div style={{ position: "relative", padding: "14px 20px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 28,
                      fontWeight: 500,
                      color: "var(--accent)",
                      display: "block",
                    }}
                  >
                    {unlockedCount}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    unlocked
                  </span>
                </div>
              </div>

              {/* Total events stat */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  overflow: "hidden",
                  minWidth: 140,
                  position: "relative",
                }}
              >
                <img
                  src="/images/stat-events.jpg"
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.18,
                    display: "block",
                  }}
                />
                <div style={{ position: "relative", padding: "14px 20px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 28,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      display: "block",
                    }}
                  >
                    {totalEntries}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    total events
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* No wallet */}
        {!connected && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              No wallet connected
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Connect a wallet to view your access activity and payment history.
            </p>
          </div>
        )}

        {/* Connected content */}
        {connected && (
          <>
            {fetchState.status === "done" && fetchState.entries.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Filter by resource ID..."
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    borderRadius: 4,
                    padding: "8px 12px",
                    width: "100%",
                    maxWidth: 360,
                    outline: "none",
                  }}
                />
              </div>
            )}

            {fetchState.status === "loading" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                >
                  Loading activity...
                </span>
              </div>
            )}

            {fetchState.status === "error" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid #e0525230",
                  borderRadius: 8,
                  padding: "24px",
                }}
              >
                <p style={{ fontSize: 13, color: "var(--error)", marginBottom: 12 }}>
                  {fetchState.message}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    fontSize: 12,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    borderRadius: 4,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {fetchState.status === "done" && (
              <LedgerTable entries={filteredEntries} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
