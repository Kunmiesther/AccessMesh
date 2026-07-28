import { abbreviateIdentifier } from "@/lib/ui";

export function formatUSDCAmount(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not enough data";
  }

  return `${value} USDC`;
}

export function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not enough data";
  }

  const percentValue = value * 100;
  const rounded = percentValue >= 10 ? Math.round(percentValue) : Math.round(percentValue * 10) / 10;
  return `${stripTrailingZeros(rounded.toFixed(percentValue >= 10 ? 0 : 1))}%`;
}

export function formatDurationMs(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "Not enough data";
  }

  const totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatTrendDateLabel(
  value: string,
  granularity: "day" | "month",
) {
  if (!value) {
    return "Unknown time";
  }

  if (granularity === "month") {
    const parsed = parseMonthKey(value);
    return parsed
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
        }).format(parsed)
      : value;
  }

  const parsed = parseDayKey(value);
  return parsed
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(parsed)
    : value;
}

export function formatShortDateTime(iso: string | null | undefined) {
  if (!iso) {
    return "Not available";
  }

  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatAbbreviatedIdentifier(value: string | null | undefined) {
  if (!value) {
    return "Unavailable";
  }

  return abbreviateIdentifier(value, { start: 8, end: 6 });
}

function parseDayKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseMonthKey(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = new Date(Date.UTC(year, month, 1));
  return Number.isFinite(date.getTime()) ? date : null;
}

function stripTrailingZeros(value: string) {
  return value.includes(".") ? value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") : value;
}
