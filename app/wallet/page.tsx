"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/hooks/useWallet";
import { getStoredCredentialMode, type PasskeyCredentialMode } from "@/lib/modular-wallet";

function WalletPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connectWallet, loading, error } = useWallet();
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState<PasskeyCredentialMode | null>(null);
  const nextPath = searchParams.get("next") || "/dashboard";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setFormError("Enter a username to continue.");
      return;
    }

    setFormError(null);
    const storedMode = getStoredCredentialMode(trimmedUsername);
    setFlowMode(storedMode);
    await connectWallet(trimmedUsername, {
      onCredentialMode: setFlowMode,
    });
    router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
  }

  const visibleError = formError ?? error;
  const flowMessage =
    flowMode === "existing"
      ? {
          title: "Username already exists.",
          body: "Continue with your existing passkey.",
        }
      : flowMode === "new"
        ? {
            title: "Creating a new AccessMesh identity.",
            body: "A new passkey will be created.",
          }
        : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main
        style={{
          minHeight: "calc(100vh - 56px)",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 420,
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 12,
              }}
            >
              Modular Wallet
            </p>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 600,
                lineHeight: 1.15,
                marginBottom: 12,
              }}
            >
              Continue to AccessMesh
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.7,
              }}
            >
              Use a passkey to create or unlock your smart account identity.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username webauthn"
              value={username}
              disabled={loading}
              onChange={(event) => {
                setUsername(event.target.value);
                setFormError(null);
                setFlowMode(null);
              }}
              placeholder="name@example.com"
              style={{
                width: "100%",
                fontSize: 14,
                background: "#0a0a0a",
                border: `1px solid ${
                  visibleError ? "var(--error)" : "var(--border)"
                }`,
                color: "var(--text-primary)",
                borderRadius: 4,
                padding: "11px 12px",
                outline: "none",
                marginBottom: 12,
              }}
            />

            {flowMessage && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "10px 12px",
                  marginBottom: 12,
                  background: "#0a0a0a",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                    marginBottom: 4,
                  }}
                >
                  {flowMessage.title}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {flowMessage.body}
                </p>
              </div>
            )}

            {visibleError && (
              <p
                style={{
                  color: "var(--error)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {visibleError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "var(--accent-dim)" : "var(--accent)",
                color: loading ? "var(--text-secondary)" : "#000",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                padding: "11px 14px",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Initializing wallet..." : "Continue with Passkey"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletPageContent />
    </Suspense>
  );
}
