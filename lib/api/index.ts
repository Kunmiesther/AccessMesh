import type {
  AccessIntentResponse,
  DashboardResponse,
  LedgerResponse,
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerifyResponse,
  ProtocolStatsResponse,
  PurchaseListResponse,
  RecentActivityResponse,
  CreateResourceRequest,
  CreateResourceResponse,
  ResourceDetailResponse,
  ResourceListResponse,
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

  return apiFetch<AccessIntentResponse>(`/api/access/${resourceId}?${params}`, {
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": wallet,
    },
  });
}

// POST /api/access/unlock
export async function postUnlock(
  body: UnlockRequest,
  opts?: { wallet?: string },
): Promise<UnlockResponse> {
  return apiFetch<UnlockResponse>("/api/access/unlock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.wallet ? { "x-wallet-address": opts.wallet } : {}),
    },
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

export async function getPurchases(wallet: string): Promise<PurchaseListResponse> {
  const params = new URLSearchParams({ wallet });
  return apiFetch<PurchaseListResponse>(`/api/purchases?${params}`);
}

export async function getResources(opts: {
  ownerWallet?: string;
  includeInactive?: boolean;
}): Promise<ResourceListResponse> {
  const params = new URLSearchParams();
  if (opts.ownerWallet) params.set("ownerWallet", opts.ownerWallet);
  if (opts.includeInactive) params.set("includeInactive", "true");

  return apiFetch<ResourceListResponse>(`/api/resource/create?${params}`);
}

export async function getFeaturedResources(): Promise<ResourceListResponse> {
  return apiFetch<ResourceListResponse>("/api/resources/featured");
}

export async function getMarketplaceResources(): Promise<ResourceListResponse> {
  return apiFetch<ResourceListResponse>("/api/resources");
}

export async function getResourceDetail(
  resourceId: string,
  wallet?: string | null,
): Promise<ResourceDetailResponse> {
  const params = new URLSearchParams();
  if (wallet) params.set("wallet", wallet);
  const query = params.toString();

  return apiFetch<ResourceDetailResponse>(
    `/api/resource/${resourceId}${query ? `?${query}` : ""}`,
    wallet
      ? {
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": wallet,
          },
        }
      : undefined,
  );
}

export async function postResource(
  body: CreateResourceRequest,
  opts?: { wallet?: string },
): Promise<CreateResourceResponse> {
  return apiFetch<CreateResourceResponse>("/api/resource/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.wallet ? { "x-wallet-address": opts.wallet } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function getProtocolStats(): Promise<ProtocolStatsResponse> {
  return apiFetch<ProtocolStatsResponse>("/api/protocol/stats");
}

export async function getRecentActivity(): Promise<RecentActivityResponse> {
  return apiFetch<RecentActivityResponse>("/api/activity/recent");
}

export async function getDashboard(wallet: string): Promise<DashboardResponse> {
  const params = new URLSearchParams({ wallet });
  return apiFetch<DashboardResponse>(`/api/dashboard?${params}`);
}
