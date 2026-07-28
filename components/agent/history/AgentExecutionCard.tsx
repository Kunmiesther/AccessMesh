import Link from "next/link";
import type { ReactNode } from "react";
import { abbreviateIdentifier, formatDateTime, formatUSDC } from "@/lib/ui";
import type { AgentExecutionSummary } from "@/services/agent/AgentExecutionTypes";
import { AgentDecisionBadge } from "./AgentDecisionBadge";
import { AgentExecutionStatusBadge } from "./AgentExecutionStatusBadge";

export function AgentExecutionCard({
  execution,
}: {
  execution: AgentExecutionSummary;
}) {
  const isFailed = execution.status === "FAILED";

  return (
    <article style={cardStyle(isFailed)}>
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <div style={badgeRowStyle}>
            <AgentDecisionBadge decision={execution.decision} />
            <AgentExecutionStatusBadge status={execution.status} />
          </div>
          <h3 style={titleStyle}>{execution.goal}</h3>
        </div>
        <Link href={`/agent/executions/${execution.id}`} style={viewLinkStyle}>
          Open execution
        </Link>
      </div>

      <div style={bodyGridStyle}>
        <Info label="Selected resource" value={execution.selectedResourceTitle ?? "Unavailable"} />
        <Info
          label="Estimated cost"
          value={
            execution.estimatedCostUSDC === null
              ? "Unavailable"
              : formatUSDC(execution.estimatedCostUSDC)
          }
        />
        <Info
          label="Transaction"
          value={
            execution.txHash ? (
              <span title={execution.txHash}>
                {abbreviateIdentifier(execution.txHash, { start: 8, end: 6 })}
              </span>
            ) : (
              "Unavailable"
            )
          }
        />
        <Info
          label="Created"
          value={
            <span title={execution.createdAt}>
              {formatDateTime(execution.createdAt)}
            </span>
          }
        />
        <Info
          label="Updated"
          value={
            <span title={execution.updatedAt}>
              {formatDateTime(execution.updatedAt)}
            </span>
          }
        />
        <Info
          label="Completed"
          value={
            execution.completedAt ? (
              <span title={execution.completedAt}>
                {formatDateTime(execution.completedAt)}
              </span>
            ) : (
              "Not completed"
            )
          }
        />
      </div>

      {isFailed && execution.failureCode ? (
        <p style={failureStyle}>
          Failure: {execution.failureCode}
          {execution.failureStage ? ` at ${execution.failureStage.toLowerCase()}` : ""}
        </p>
      ) : null}
    </article>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div style={infoStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
    </div>
  );
}

const cardStyle = (failed: boolean) =>
  ({
    borderRadius: 18,
    border: failed ? "1px solid rgba(224,82,82,0.28)" : "1px solid var(--border)",
    background: failed ? "rgba(224,82,82,0.04)" : "rgba(13, 15, 17, 0.96)",
    padding: 18,
    display: "grid",
    gap: 16,
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

const titleStyle = {
  color: "var(--text-primary)",
  fontSize: 18,
  lineHeight: 1.45,
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

const bodyGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
} as const;

const infoStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-subtle)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  minWidth: 0,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const valueStyle = {
  color: "var(--text-primary)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere" as const,
} as const;

const failureStyle = {
  borderRadius: 12,
  border: "1px solid rgba(224,82,82,0.2)",
  background: "rgba(224,82,82,0.06)",
  padding: "10px 12px",
  color: "var(--error)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
} as const;
