import type {
  AccessIntentResponse,
  LedgerResponse,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerifyResponse,
  UnlockRequest,
  UnlockResponse,
} from "@/types";

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message ?? data?.message ?? "Request failed";
    throw new ApiError(message, res.status, data?.error?.code);
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// GET /api/access/[id]?wallet=&recipientWallet=&amountUSDC=
export async function getAccessIntent(
  resourceId: string,
  wallet: string,
  opts?: { recipientWallet?: string; amountUSDC?: string },
): Promise<AccessIntentResponse> {
  const params = new URLSearchParams({ wallet });
  if (opts?.recipientWallet) params.set("recipientWallet", opts.recipientWallet);
  if (opts?.amountUSDC) params.set("amountUSDC", opts.amountUSDC);

  return apiFetch<AccessIntentResponse>(`/api/access/${resourceId}?${params}`);
}

// POST /api/access/unlock
export async function postUnlock(
  body: UnlockRequest,
): Promise<UnlockResponse> {
  return apiFetch<UnlockResponse>("/api/access/unlock", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// POST /api/payment/initiate
export async function postPaymentInitiate(
  body: PaymentInitiateRequest,
): Promise<PaymentInitiateResponse> {
  return apiFetch<PaymentInitiateResponse>("/api/payment/initiate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// POST /api/payment/verify
export async function postPaymentVerify(
  txHash: string,
): Promise<PaymentVerifyResponse> {
  return apiFetch<PaymentVerifyResponse>("/api/payment/verify", {
    method: "POST",
    body: JSON.stringify({ txHash }),
  });
}

// GET /api/ledger?wallet=&resourceId=&limit=
export async function getLedger(opts: {
  wallet?: string;
  resourceId?: string;
  limit?: number;
}): Promise<LedgerResponse> {
  const params = new URLSearchParams();
  if (opts.wallet) params.set("wallet", opts.wallet);
  if (opts.resourceId) params.set("resourceId", opts.resourceId);
  if (opts.limit) params.set("limit", String(opts.limit));

  return apiFetch<LedgerResponse>(`/api/ledger?${params}`);
}