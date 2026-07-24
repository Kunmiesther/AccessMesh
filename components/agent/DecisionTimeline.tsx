export function DecisionTimeline({
  trace,
}: {
  trace: Array<{
    step: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    message: string;
  }>;
}) {
  return (
    <section style={panelStyle} aria-label="Decision timeline">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Decision timeline</p>
          <h2 style={titleStyle}>A structured record of how the recommendation was produced.</h2>
        </div>
      </div>

      <ol style={listStyle}>
        {trace.map((entry) => (
          <li key={`${entry.step}-${entry.status}-${entry.message}`} style={rowStyle}>
            <span style={stepStyle}>{entry.step}</span>
            <span style={statusStyle(entry.status)}>{entry.status}</span>
            <p style={messageStyle}>{entry.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const panelStyle = {
  background: "rgba(13, 15, 17, 0.96)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
  display: "grid",
  gap: 16,
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
  lineHeight: 1.4,
  color: "var(--text-primary)",
} as const;

const listStyle = {
  listStyle: "none",
  display: "grid",
  gap: 10,
} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "auto auto 1fr",
  gap: 10,
  alignItems: "start",
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const stepStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  wordBreak: "break-word" as const,
} as const;

const statusStyle = (status: "SUCCESS" | "FAILED" | "SKIPPED") =>
  ({
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    borderRadius: 999,
    padding: "5px 8px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
    color:
      status === "SUCCESS"
        ? "var(--success)"
        : status === "FAILED"
          ? "var(--error)"
          : "var(--warning)",
    border:
      status === "SUCCESS"
        ? "1px solid rgba(76,175,125,0.25)"
        : status === "FAILED"
          ? "1px solid rgba(224,82,82,0.25)"
          : "1px solid rgba(200,151,42,0.25)",
    background:
      status === "SUCCESS"
        ? "rgba(76,175,125,0.08)"
        : status === "FAILED"
          ? "rgba(224,82,82,0.08)"
          : "rgba(200,151,42,0.08)",
  }) as const;

const messageStyle = {
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  minWidth: 0,
  overflowWrap: "anywhere" as const,
} as const;
