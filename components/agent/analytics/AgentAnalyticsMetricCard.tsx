import type { ReactNode } from "react";

export function AgentAnalyticsMetricCard({
  label,
  value,
  description,
  title,
}: {
  label: string;
  value: ReactNode;
  description: string;
  title?: string;
}) {
  return (
    <article style={cardStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle} title={title}>
        {value}
      </p>
      <p style={descriptionStyle}>{description}</p>
    </article>
  );
}

const cardStyle = {
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 16,
  display: "grid",
  gap: 10,
  minWidth: 0,
} as const;

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const valueStyle = {
  color: "var(--text-primary)",
  fontSize: 26,
  lineHeight: 1.1,
  overflowWrap: "anywhere" as const,
} as const;

const descriptionStyle = {
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;

