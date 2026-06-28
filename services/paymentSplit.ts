import { normalizeAddress, normalizeOptionalAddress } from "@/lib/validation";

export const CREATOR_SHARE_BPS = 9500;
export const TREASURY_SHARE_BPS = 500;

export function getTreasuryWallet() {
  return normalizeOptionalAddress(process.env.ACCESSMESH_TREASURY_WALLET);
}

export function splitUsdcAmount(amountUSDC: number) {
  const totalMicros = toMicros(amountUSDC);
  const creatorMicros = Math.floor((totalMicros * CREATOR_SHARE_BPS) / 10_000);
  const treasuryMicros = totalMicros - creatorMicros;

  return {
    creatorAmountUSDC: fromMicros(creatorMicros),
    treasuryAmountUSDC: fromMicros(treasuryMicros),
  };
}

export function normalizeTreasuryWallet(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizeAddress(value, "treasuryWallet");
}

function toMicros(amount: number) {
  return Math.round(amount * 1_000_000);
}

function fromMicros(micros: number) {
  return micros / 1_000_000;
}
