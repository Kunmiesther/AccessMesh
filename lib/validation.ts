import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";

export const UNKNOWN_WALLET = "UNKNOWN";

export function normalizeAddress(value: unknown, field = "wallet"): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new InputError(`${field} must be a valid EVM address`);
  }

  return getAddress(value);
}

export function normalizeOptionalAddress(value: unknown): Address | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return normalizeAddress(value);
}

export function normalizeTxHash(value: unknown): Hash {
  if (typeof value !== "string" || !isHash(value)) {
    throw new InputError("txHash must be a valid transaction hash");
  }

  return value.toLowerCase() as Hash;
}

export function parsePositiveUsdcAmount(value: unknown): number {
  const amount = typeof value === "string" ? Number(value) : value;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new InputError("priceUSDC must be a positive number");
  }

  assertUsdcPrecision(amount);
  return amount;
}

export function usdcAmountToString(amount: number): string {
  assertUsdcPrecision(amount);
  return amount.toString();
}

function assertUsdcPrecision(amount: number) {
  const normalized = amount.toString();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new InputError("USDC amounts must use at most 6 decimal places");
  }
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function getWalletFromRequest(request: Request) {
  const url = new URL(request.url);
  return (
    request.headers.get("x-accessmesh-wallet") ??
    request.headers.get("x-wallet-address") ??
    request.headers.get("x-payer-wallet") ??
    url.searchParams.get("wallet")
  );
}
