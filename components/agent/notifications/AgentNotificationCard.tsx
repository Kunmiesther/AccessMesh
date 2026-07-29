"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/ui";
import type { AgentNotificationSummaryView } from "@/services/agent/AgentNotificationTypes";
import { AgentNotificationTypeBadge } from "./AgentNotificationTypeBadge";

export function AgentNotificationCard({
  notification,
}: {
  notification: AgentNotificationSummaryView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function markRead() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/agent/notifications/${notification.id}/read`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError("The notification could not be updated.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <article style={cardStyle(notification.isUnread)}>
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <div style={badgeRowStyle}>
            <AgentNotificationTypeBadge type={notification.type} />
            {notification.isUnread ? <span style={unreadPillStyle}>Unread</span> : null}
          </div>
          <h3 style={titleStyle}>{notification.title}</h3>
        </div>

        {notification.actionPath ? (
          <Link href={notification.actionPath} style={viewLinkStyle}>
            Open
          </Link>
        ) : null}
      </div>

      <p style={messageStyle}>{notification.message}</p>

      <div style={footerStyle}>
        <p style={timeStyle} title={notification.createdAt}>
          {formatDateTime(notification.createdAt)}
        </p>
        <div style={actionRowStyle}>
          {notification.isUnread ? (
            <button type="button" onClick={markRead} disabled={pending} style={secondaryButtonStyle}>
              {pending ? "Saving..." : "Mark as read"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p style={errorStyle}>{error}</p> : null}
    </article>
  );
}

const cardStyle = (unread: boolean) =>
  ({
    borderRadius: 18,
    border: unread ? "1px solid rgba(0,194,168,0.24)" : "1px solid var(--border)",
    background: unread ? "rgba(0,194,168,0.04)" : "rgba(13, 15, 17, 0.96)",
    padding: 18,
    display: "grid",
    gap: 12,
    minWidth: 0,
  }) as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

const titleBlockStyle = {
  display: "grid",
  gap: 10,
  minWidth: 0,
} as const;

const badgeRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const unreadPillStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  background: "rgba(0,194,168,0.08)",
  border: "1px solid rgba(0,194,168,0.25)",
  borderRadius: 999,
  padding: "6px 9px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap" as const,
} as const;

const titleStyle = {
  color: "var(--text-primary)",
  fontSize: 17,
  lineHeight: 1.4,
  overflowWrap: "anywhere" as const,
} as const;

const viewLinkStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "10px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
} as const;

const messageStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  fontSize: 13,
} as const;

const footerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
} as const;

const timeStyle = {
  color: "var(--text-muted)",
  fontSize: 12,
  lineHeight: 1.5,
} as const;

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
} as const;

const secondaryButtonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "10px 12px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
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
