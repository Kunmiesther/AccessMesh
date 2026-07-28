import Link from "next/link";
import type { AgentExecutionHistoryQuery } from "@/services/agent/AgentExecutionHistory";

export function AgentHistoryPagination({
  nextCursor,
  query,
}: {
  nextCursor: string | null;
  query: AgentExecutionHistoryQuery;
}) {
  if (!nextCursor) {
    return null;
  }

  const href = buildHref(query, nextCursor);

  return (
    <div style={panelStyle}>
      <Link href={href} style={buttonStyle}>
        Load more
      </Link>
      <p style={copyStyle}>Showing more executions from your history.</p>
    </div>
  );
}

function buildHref(query: AgentExecutionHistoryQuery, cursor: string) {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit));
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.decision !== "all") {
    params.set("decision", query.decision);
  }
  params.set("cursor", cursor);
  return `/agent/history?${params.toString()}`;
}

const panelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "space-between",
} as const;

const buttonStyle = {
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#000",
  padding: "11px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const;

const copyStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;
