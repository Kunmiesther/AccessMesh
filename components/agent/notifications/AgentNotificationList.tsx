"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { AgentNotificationFilter, AgentNotificationPage } from "@/services/agent/AgentNotificationTypes";
import { AgentNotificationCard } from "./AgentNotificationCard";
import { AgentNotificationEmptyState } from "./AgentNotificationEmptyState";
import { AgentNotificationPagination } from "./AgentNotificationPagination";

export function AgentNotificationList({
  page,
  filter,
}: {
  page: AgentNotificationPage;
  filter: AgentNotificationFilter;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function markAllAsRead() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/agent/notifications/read-all", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError("The notifications could not be updated.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <section style={panelStyle} aria-label="Notifications">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Notification list</p>
          <h2 style={titleStyle}>{filter === "unread" ? "Unread notifications" : "All notifications"}</h2>
        </div>

        <div style={actionRowStyle}>
          <FilterLink href="/agent/notifications?filter=all" active={filter === "all"}>
            All
          </FilterLink>
          <FilterLink href="/agent/notifications?filter=unread" active={filter === "unread"}>
            Unread
          </FilterLink>
          <button type="button" onClick={markAllAsRead} disabled={busy} style={markAllButtonStyle}>
            {busy ? "Saving..." : "Mark all as read"}
          </button>
        </div>
      </div>

      {error ? <p style={errorStyle}>{error}</p> : null}

      {page.notifications.length === 0 ? (
        <AgentNotificationEmptyState
          title={filter === "unread" ? "No unread notifications" : undefined}
          copy={
            filter === "unread"
              ? "All notifications have been read for now."
              : "Important agent events will appear here when they are recorded."
          }
        />
      ) : (
        <div style={listStyle}>
          {page.notifications.map((notification) => (
            <AgentNotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}

      <AgentNotificationPagination nextCursor={page.nextCursor} filter={filter} />
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} style={filterLinkStyle(active)}>
      {children}
    </Link>
  );
}

const panelStyle = {
  display: "grid",
  gap: 16,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const titleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
} as const;

const filterLinkStyle = (active: boolean) =>
  ({
    borderRadius: 999,
    border: active ? "1px solid rgba(0,194,168,0.28)" : "1px solid var(--border)",
    background: active ? "rgba(0,194,168,0.08)" : "rgba(255,255,255,0.03)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    padding: "9px 12px",
    textDecoration: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  }) as const;

const markAllButtonStyle = {
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "9px 12px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  cursor: "pointer",
} as const;

const errorStyle = {
  borderRadius: 12,
  border: "1px solid rgba(224,82,82,0.25)",
  background: "rgba(224,82,82,0.08)",
  color: "var(--error)",
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

const listStyle = {
  display: "grid",
  gap: 14,
} as const;
