"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { getResourceDetail } from "@/lib/api";
import { formatDate, formatUSDC, shortAddress } from "@/lib/ui";
import { useWallet } from "@/lib/ui/WalletContext";
import type { ResourceDetail } from "@/types";

type PageState =
  | { status: "loading" }
  | { status: "done"; resource: ResourceDetail }
  | { status: "error"; message: string };

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, connected } = useWallet();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    setState({ status: "loading" });
    getResourceDetail(id, address)
      .then((response) => setState({ status: "done", resource: response.resource }))
      .catch((error: Error) => {
        setState({ status: "error", message: error.message });
      });
  }, [address, id]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "44px 24px 80px" }}>
        <Link href="/explore" style={backLinkStyle}>
          Back to marketplace
        </Link>

        {state.status === "loading" && (
          <section style={panelStyle}>
            <p style={{ color: "var(--text-muted)" }}>Loading resource...</p>
          </section>
        )}

        {state.status === "error" && (
          <section style={panelStyle}>
            <p style={{ color: "var(--error)", lineHeight: 1.6 }}>{state.message}</p>
          </section>
        )}

        {state.status === "done" && (
          <ResourceDetailView
            resource={state.resource}
            connected={connected}
            onUnlock={() => {
              if (!connected) {
                router.push(`/wallet?next=/resource/${state.resource.id}`);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function ResourceDetailView({
  resource,
  connected,
  onUnlock,
}: {
  resource: ResourceDetail;
  connected: boolean;
  onUnlock: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>{resource.category}</p>
        <h1
          style={{
            fontSize: 30,
            lineHeight: 1.18,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          {resource.title || resource.name}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: 22,
          }}
        >
          {resource.description}
        </p>

        <div style={metaGridStyle}>
          <MetaItem label="Price" value={formatUSDC(resource.priceUSDC)} />
          <MetaItem label="Creator" value={shortAddress(resource.creatorWallet)} />
          <MetaItem label="Published" value={formatDate(resource.createdAt)} />
          <MetaItem label="Unlocks" value={String(resource.unlockCount)} />
        </div>
      </section>

      {resource.owned ? (
        <OwnedContent resource={resource} />
      ) : (
        <LockedContent connected={connected} onUnlock={onUnlock} />
      )}
    </div>
  );
}

function OwnedContent({ resource }: { resource: ResourceDetail }) {
  const resourceUrl = resource.resourceUrl ?? resource.endpoint ?? "";

  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Full content</p>
      <h2 style={sectionTitleStyle}>Resource access</h2>
      <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
        You own this resource. The protected resource location is available below.
      </p>
      <div style={resourceUrlBoxStyle}>
        <span style={{ overflowWrap: "anywhere" }}>{resourceUrl}</span>
      </div>
      <a
        href={resourceUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          marginTop: 16,
          background: "var(--accent)",
          color: "#000",
          borderRadius: 4,
          padding: "10px 14px",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Open Resource
      </a>
    </section>
  );
}

function LockedContent({
  connected,
  onUnlock,
}: {
  connected: boolean;
  onUnlock: () => void;
}) {
  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>Locked content</p>
      <h2 style={sectionTitleStyle}>Protected resource preview</h2>
      <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 18 }}>
        This resource is locked. The resource URL and protected content are hidden
        until access is unlocked.
      </p>
      <div style={previewStyle}>
        <div style={{ height: 10, width: "80%", background: "var(--border)" }} />
        <div style={{ height: 10, width: "62%", background: "var(--border)" }} />
        <div style={{ height: 10, width: "70%", background: "var(--border)" }} />
      </div>
      <button
        type="button"
        onClick={onUnlock}
        style={{
          marginTop: 18,
          background: connected ? "var(--accent-dim)" : "var(--accent)",
          color: connected ? "var(--text-secondary)" : "#000",
          border: connected ? "1px solid rgba(0,194,168,0.28)" : "none",
          borderRadius: 4,
          padding: "10px 14px",
          fontWeight: 600,
          fontSize: 13,
          cursor: connected ? "default" : "pointer",
        }}
      >
        {connected ? "Unlock coming soon" : "Connect to unlock"}
      </button>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <p style={metaLabelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
    </div>
  );
}

const backLinkStyle = {
  display: "inline-block",
  color: "var(--text-secondary)",
  textDecoration: "none",
  marginBottom: 18,
  fontSize: 13,
} satisfies CSSProperties;

const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 24,
} satisfies CSSProperties;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
} satisfies CSSProperties;

const sectionTitleStyle = {
  fontSize: 18,
  color: "var(--text-primary)",
  marginBottom: 10,
} satisfies CSSProperties;

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const metaItemStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 6,
  padding: 14,
  minWidth: 0,
} satisfies CSSProperties;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 7,
} satisfies CSSProperties;

const metaValueStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
  overflowWrap: "anywhere",
  lineHeight: 1.5,
} satisfies CSSProperties;

const previewStyle = {
  display: "grid",
  gap: 10,
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 16,
} satisfies CSSProperties;

const resourceUrlBoxStyle = {
  background: "#0a0a0a",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 14,
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.6,
} satisfies CSSProperties;
