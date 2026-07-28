import type { AgentAnalyticsPeriod } from "@/services/agent/AgentExecutionAnalytics";

export const ANALYTICS_PERIOD_OPTIONS: Array<{
  value: AgentAnalyticsPeriod;
  label: string;
  description: string;
}> = [
  { value: "30d", label: "Last 30 days", description: "Default reporting period" },
  { value: "7d", label: "Last 7 days", description: "Short-term view" },
  { value: "90d", label: "Last 90 days", description: "Longer trend window" },
  { value: "all", label: "All time", description: "Entire persisted history" },
];

export const ANALYTICS_CORE_METRICS = [
  {
    key: "executions",
    label: "Executions",
    description: "All persisted agent runs in the selected period.",
  },
  {
    key: "buyRecommendationRate",
    label: "BUY recommendation rate",
    description: "BUY recommendations divided by BUY and SKIP decisions only.",
  },
  {
    key: "purchaseConversionRate",
    label: "Purchase conversion",
    description: "Executions that reached payment submission divided by BUY recommendations.",
  },
  {
    key: "completedUSDC",
    label: "Completed spend",
    description: "USDC confirmed through trusted unlock completion.",
  },
  {
    key: "completionRate",
    label: "Completion rate",
    description: "Completed executions divided by all executions in the period.",
  },
  {
    key: "failureRate",
    label: "Failure rate",
    description: "Failed executions divided by all executions in the period.",
  },
] as const;

