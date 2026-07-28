import type { ReactNode } from "react";

export function AgentAnalyticsMetricGrid({
  children,
}: {
  children: ReactNode;
}) {
  return <section style={gridStyle}>{children}</section>;
}

const gridStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
} as const;

