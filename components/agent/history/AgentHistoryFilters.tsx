import Link from "next/link";
import type {
  AgentExecutionHistoryDecisionFilter,
  AgentExecutionHistoryStatusFilter,
} from "@/services/agent/AgentExecutionHistory";

const STATUS_OPTIONS: Array<{
  value: AgentExecutionHistoryStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "buy-recommended", label: "Buy recommended" },
  { value: "skipped", label: "Skipped" },
  { value: "awaiting-approval", label: "Awaiting approval" },
  { value: "payment-submitted", label: "Payment submitted" },
  { value: "verifying-settlement", label: "Verifying settlement" },
  { value: "unlocking", label: "Unlocking" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const DECISION_OPTIONS: Array<{
  value: AgentExecutionHistoryDecisionFilter;
  label: string;
}> = [
  { value: "all", label: "All decisions" },
  { value: "BUY", label: "BUY" },
  { value: "SKIP", label: "SKIP" },
];

export function AgentHistoryFilters({
  status,
  decision,
  limit,
}: {
  status: AgentExecutionHistoryStatusFilter;
  decision: AgentExecutionHistoryDecisionFilter;
  limit: number;
}) {
  return (
    <section style={panelStyle} aria-label="Execution filters">
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Filters</p>
          <h2 style={titleStyle}>Review execution outcomes</h2>
        </div>
        <Link href="/agent/history" style={clearLinkStyle}>
          Clear filters
        </Link>
      </div>

      <form method="get" style={formStyle}>
        <input type="hidden" name="limit" value={String(limit)} />
        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Decision</span>
            <select name="decision" defaultValue={decision} style={selectStyle}>
              {DECISION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Status</span>
            <select name="status" defaultValue={status} style={selectStyle}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div style={buttonRowStyle}>
            <button type="submit" style={buttonStyle}>
              Apply filters
            </button>
          </div>
        </div>
      </form>
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
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
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

const clearLinkStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  textDecoration: "none",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.03)",
  whiteSpace: "nowrap" as const,
} as const;

const formStyle = {
  display: "grid",
  gap: 12,
} as const;

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  alignItems: "end",
} as const;

const fieldStyle = {
  display: "grid",
  gap: 8,
} as const;

const labelTextStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const selectStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#0d0f11",
  color: "var(--text-primary)",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
} as const;

const buttonRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
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
  cursor: "pointer",
} as const;
