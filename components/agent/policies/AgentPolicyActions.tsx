"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgentPolicyStatus } from "@/services/agent/AgentPolicyTypes";

type ActionName = "duplicate" | "default" | "archive" | "restore";

export function AgentPolicyActions({
  policyId,
  status,
  isDefault,
}: {
  policyId: string;
  status: AgentPolicyStatus;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ActionName | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function performAction(action: ActionName, path: string) {
    setBusyAction(action);
    setError(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } | string }
        | null;

      if (!response.ok || !payload?.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error?.message ?? "The policy action could not be completed.";
        throw new Error(message);
      }

      if (action === "duplicate" && payload && typeof payload === "object" && "policy" in payload) {
        const duplicated = (payload as { policy?: { id?: string } }).policy;
        if (duplicated?.id) {
          router.push(`/agent/policies/${duplicated.id}/edit`);
          return;
        }
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The policy action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDuplicate() {
    await performAction("duplicate", `/api/agent/policies/${policyId}/duplicate`);
  }

  async function handleSetDefault() {
    await performAction("default", `/api/agent/policies/${policyId}/set-default`);
  }

  async function handleArchive() {
    if (!window.confirm("Archive this policy? It will no longer be available for new runs.")) {
      return;
    }

    await performAction("archive", `/api/agent/policies/${policyId}/archive`);
  }

  async function handleRestore() {
    await performAction("restore", `/api/agent/policies/${policyId}/restore`);
  }

  return (
    <div style={actionsWrapStyle}>
      <Link href={`/agent/policies/${policyId}/edit`} style={secondaryLinkStyle}>
        Edit
      </Link>
      <button type="button" onClick={handleDuplicate} disabled={busyAction !== null} style={secondaryButtonStyle}>
        {busyAction === "duplicate" ? "Duplicating..." : "Duplicate"}
      </button>
      {!isDefault && status === "ACTIVE" ? (
        <button
          type="button"
          onClick={handleSetDefault}
          disabled={busyAction !== null}
          style={secondaryButtonStyle}
        >
          {busyAction === "default" ? "Updating..." : "Make default"}
        </button>
      ) : null}
      {status === "ACTIVE" ? (
        <button
          type="button"
          onClick={handleArchive}
          disabled={busyAction !== null}
          style={dangerButtonStyle}
        >
          {busyAction === "archive" ? "Archiving..." : "Archive"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRestore}
          disabled={busyAction !== null}
          style={secondaryButtonStyle}
        >
          {busyAction === "restore" ? "Restoring..." : "Restore"}
        </button>
      )}
      {error ? <p style={errorStyle}>{error}</p> : null}
    </div>
  );
}

const actionsWrapStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
} as const;

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "9px 12px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;

const secondaryButtonStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "9px 12px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  borderRadius: 10,
  border: "1px solid rgba(224,82,82,0.28)",
  background: "rgba(224,82,82,0.08)",
  color: "var(--error)",
  padding: "9px 12px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const errorStyle = {
  color: "var(--error)",
  fontSize: 12,
  lineHeight: 1.5,
  flexBasis: "100%",
} as const;

