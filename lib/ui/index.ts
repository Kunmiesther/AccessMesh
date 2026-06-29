import { type ClassValue, clsx } from "clsx";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a wallet address for display: 0x1234...abcd
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format USDC amount
export function formatUSDC(amount: number): string {
  return `${amount.toFixed(2)} USDC`;
}

// Format ISO date string to readable
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Status label normalisation
export function normaliseStatus(raw: string): string {
  return raw.replace(/_/g, " ").toLowerCase();
}

export function arcExplorerTxUrl(txHash: string): string {
  return `${getArcExplorerBase()}/tx/${encodeURIComponent(txHash)}`;
}

export function arcExplorerAddressUrl(address: string): string {
  return `${getArcExplorerBase()}/address/${encodeURIComponent(address)}`;
}

export function appResourceUrl(resourceId: string): string {
  return buildAppUrl(`/resource/${resourceId}`);
}

export function buildAppUrl(path: string): string {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const runtimeBase =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const base = normalizeBaseUrl(configuredBase || runtimeBase);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}

function getArcExplorerBase() {
  const explorerUrl = ArcTestnet.explorerUrl || "https://testnet.arcscan.app";
  const withoutTemplate = explorerUrl
    .replace(/\/tx\/\{hash\}\/?$/i, "")
    .replace(/\/address\/\{address\}\/?$/i, "");

  return normalizeBaseUrl(withoutTemplate);
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}
