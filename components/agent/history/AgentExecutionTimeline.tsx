import { formatDateTime } from "@/lib/ui";
import type { AgentExecutionDetailView } from "@/services/agent/AgentExecutionTypes";
import { buildExecutionTimelineEntries } from "@/services/agent/AgentExecutionViews";

export function AgentExecutionTimeline({
  execution,
}: {
  execution: AgentExecutionDetailView;
}) {
  const events = buildExecutionTimelineEntries(execution);

  return (
    <section style={panelStyle} aria-label="Execution timeline">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Timeline</p>
          <h2 style={titleStyle}>Execution lifecycle</h2>
        </div>
      </div>

      <ol style={listStyle}>
        {events.map((event) => (
          <li key={event.key} style={rowStyle}>
            <div style={dotColumnStyle}>
              <span style={dotStyle(event.status)} aria-hidden="true" />
              <span style={lineStyle} aria-hidden="true" />
            </div>
            <div style={contentStyle}>
              <div style={rowHeaderStyle}>
                <h3 style={eventTitleStyle}>{event.label}</h3>
                <span style={statusStyle(event.status)}>{event.status}</span>
              </div>
              <p style={messageStyle}>{event.message}</p>
              {event.timestamp ? (
                <p style={timestampStyle} title={event.timestamp}>
                  {formatDateTime(event.timestamp)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
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
  listStyle: "none",
  display: "grid",
  gap: 14,
} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  gap: 12,
  alignItems: "start",
} as const;

const dotColumnStyle = {
  display: "grid",
  justifyItems: "center",
  minHeight: "100%",
  paddingTop: 6,
} as const;

const dotStyle = (status: "SUCCESS" | "FAILED" | "SKIPPED" | "CURRENT" | "COMPLETE") =>
  ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background:
      status === "FAILED"
        ? "var(--error)"
        : status === "SKIPPED"
          ? "var(--warning)"
          : status === "CURRENT"
            ? "var(--accent)"
            : "var(--success)",
  }) as const;

const lineStyle = {
  width: 2,
  flex: 1,
  background: "var(--border)",
  marginTop: 6,
  minHeight: 28,
} as const;

const contentStyle = {
  borderRadius: 16,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  display: "grid",
  gap: 8,
  minWidth: 0,
} as const;

const rowHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
} as const;

const eventTitleStyle = {
  color: "var(--text-primary)",
  fontSize: 14,
  lineHeight: 1.4,
} as const;

const statusStyle = (status: "SUCCESS" | "FAILED" | "SKIPPED" | "CURRENT" | "COMPLETE") =>
  ({
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color:
      status === "FAILED"
        ? "var(--error)"
        : status === "SKIPPED"
          ? "var(--warning)"
          : status === "CURRENT"
            ? "var(--accent)"
            : "var(--success)",
    background:
      status === "FAILED"
        ? "rgba(224,82,82,0.08)"
        : status === "SKIPPED"
          ? "rgba(200,151,42,0.08)"
          : status === "CURRENT"
            ? "rgba(0,194,168,0.08)"
            : "rgba(76,175,125,0.08)",
    border:
      status === "FAILED"
        ? "1px solid rgba(224,82,82,0.25)"
        : status === "SKIPPED"
          ? "1px solid rgba(200,151,42,0.25)"
          : status === "CURRENT"
            ? "1px solid rgba(0,194,168,0.25)"
            : "1px solid rgba(76,175,125,0.25)",
    borderRadius: 999,
    padding: "5px 8px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
  }) as const;

const messageStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  fontSize: 13,
} as const;

const timestampStyle = {
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} as const;
