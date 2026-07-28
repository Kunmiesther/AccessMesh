import { AgentExecutionCard } from "./AgentExecutionCard";
import { AgentHistoryEmptyState } from "./AgentHistoryEmptyState";
import { AgentHistoryPagination } from "./AgentHistoryPagination";
import type {
  AgentExecutionHistoryQuery,
} from "@/services/agent/AgentExecutionHistory";
import type { AgentExecutionHistoryPage } from "@/services/agent/AgentExecutionTypes";

export function AgentHistoryList({
  page,
  query,
}: {
  page: AgentExecutionHistoryPage;
  query: AgentExecutionHistoryQuery;
}) {
  if (page.executions.length === 0) {
    return <AgentHistoryEmptyState />;
  }

  return (
    <section style={panelStyle} aria-label="Execution history">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Execution history</p>
          <h2 style={titleStyle}>Previous research runs</h2>
        </div>
      </div>

      <div style={listStyle}>
        {page.executions.map((execution) => (
          <AgentExecutionCard key={execution.id} execution={execution} />
        ))}
      </div>

      <AgentHistoryPagination nextCursor={page.nextCursor} query={query} />
    </section>
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

const listStyle = {
  display: "grid",
  gap: 14,
} as const;
