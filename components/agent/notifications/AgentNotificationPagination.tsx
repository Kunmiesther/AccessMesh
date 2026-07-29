import Link from "next/link";

export function AgentNotificationPagination({
  nextCursor,
  filter,
}: {
  nextCursor: string | null;
  filter: "all" | "unread";
}) {
  if (!nextCursor) {
    return null;
  }

  const href = `/agent/notifications?filter=${filter}&cursor=${encodeURIComponent(nextCursor)}`;

  return (
    <div style={rowStyle}>
      <Link href={href} style={buttonStyle}>
        Load more
      </Link>
    </div>
  );
}

const rowStyle = {
  display: "flex",
  justifyContent: "center",
} as const;

const buttonStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  padding: "11px 14px",
  textDecoration: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
} as const;
