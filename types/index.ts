export type ResourceType = "API" | "CONTENT" | "TOOL" | "DATASET";
export type PublishedResourceType = "ARTICLE" | "FILE_UPLOAD" | "EXTERNAL_LINK";

export type ActivityEventType =
  | "RESOURCE_PUBLISHED"
  | "RESOURCE_UNLOCKED"
  | "PROTECTED_RESOURCE_ACCESSED";

export type SortMode = "newest" | "price-asc" | "price-desc";

export type ResourceMeta = {
  id: string;
  creatorWallet: string;
  creatorDisplayName?: string | null;
  title: string;
  name: string;
  description: string;
  category: ResourceType;
  type: ResourceType;
  resourceCategory?: string;
  resourceType?: PublishedResourceType;
  resourceContent?: string;
  priceUSDC: number;
  resourceUrl?: string;
  endpoint?: string;
  coverImage?: string | null;
  tags: string[];
  unlockCount: number;
  isActive: boolean;
  createdAt: string;
};

export type ResourceDetail = ResourceMeta & {
  owned: boolean;
  purchase?: PurchaseProof | null;
};

export type PurchaseProof = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  buyerWallet: string;
  creatorWallet: string;
  amountUSDC: number;
  txHash: string;
  timestamp: string;
};

export type PaymentIntent = {
  accessId: string;
  amountUSDC: number;
  recipientWallet: string;
  creatorWallet: string;
  treasuryWallet: string;
  creatorAmountUSDC: number;
  treasuryAmountUSDC: number;
  expiresAt: string;
  payerWallet: string;
  resource: ResourceMeta;
  payment: unknown;
};

export type AccessIntentResponse = {
  ok: boolean;
  paymentIntent: PaymentIntent;
};

export type UnlockRequest = {
  accessId: string;
  txHash: string;
  mockPayment?: boolean;
};

export type UnlockResponse = {
  ok: boolean;
  access: "UNLOCKED" | "LOCKED";
  accessToken?: string;
  tokenType?: string;
  expiresAt?: string;
  resourceId?: string;
  txHash?: string;
  purchase?: PurchaseProof;
  payment?: {
    id: string;
    status: string;
    txHash: string;
  };
  verification: {
    status: "SETTLED" | "CONFIRMING" | "FAILED";
    settled: boolean;
    reason?: string;
    txHash: string;
  };
};

export type PaymentInitiateRequest = {
  resourceId: string;
  wallet: string;
};

export type PaymentRequirement = {
  resourceId: string;
  amountUSDC: number;
  recipientWallet: string;
};

export type PaymentInitiateResponse = {
  ok: boolean;
  paymentRequired: PaymentRequirement;
};

export type PaymentVerifyResponse = {
  ok: boolean;
  payment: {
    id: string;
    status: "PENDING" | "CONFIRMING" | "SETTLED" | "FAILED";
    txHash: string;
  };
  verification: {
    status: string;
    settled: boolean;
  };
};

export type LedgerEntry = {
  id: string;
  resourceId: string;
  payerWallet: string;
  status: string;
  txHash: string | null;
  createdAt: string;
};

export type LedgerResponse = {
  ok: boolean;
  ledger: LedgerEntry[];
};

export type ResourceListResponse = {
  ok: boolean;
  resources: ResourceMeta[];
};

export type PurchaseListResponse = {
  ok: boolean;
  purchases: PurchaseProof[];
  paymentHistory: PurchaseProof[];
};

export type ResourceDetailResponse = {
  ok: boolean;
  resource: ResourceDetail;
};

export type CreateResourceRequest = {
  creatorWallet: string;
  creatorDisplayName?: string;
  title: string;
  description: string;
  category: string;
  priceUSDC: number | string;
  resourceType?: PublishedResourceType;
  articleContent?: string;
  fileName?: string;
  fileDataUrl?: string;
  fileMimeType?: string;
  externalUrl?: string;
  resourceUrl?: string;
  coverImage?: string;
  tags?: string[] | string;
};

export type CreateResourceResponse = {
  ok: boolean;
  resource: ResourceMeta;
};

export type ProtocolStats = {
  totalResources: number;
  totalUnlocks: number;
  totalUSDCVolume: number;
  totalCreators: number;
};

export type ProtocolStatsResponse = {
  ok: boolean;
  stats: ProtocolStats;
};

export type RecentActivityEntry = {
  id: string;
  type: ActivityEventType;
  wallet: string;
  payerWallet: string;
  resourceId: string;
  resourceTitle: string;
  resourceName: string;
  resourceType: ResourceType;
  txHash: string | null;
  createdAt: string;
};

export type RecentActivityResponse = {
  ok: boolean;
  activity: RecentActivityEntry[];
};

export type CreatorAnalytics = {
  revenueEarned: number;
  resourcesPublished: number;
  totalUnlocks: number;
  topResource: {
    id: string;
    title: string;
    revenue: number;
    unlockCount: number;
  } | null;
  x402: {
    protectedRequests: number;
    successfulAccesses: number;
    failedAccesses: number;
    conversionRate: number;
  };
};

export type CreatedResourceSummary = ResourceMeta & {
  revenue: number;
};

export type DashboardResponse = {
  ok: boolean;
  stats?: ProtocolStats;
  analytics: CreatorAnalytics;
  purchasedResources: PurchaseProof[];
  createdResources: CreatedResourceSummary[];
  paymentHistory: PurchaseProof[];
};

export type UnlockInitiateResponse = {
  ok: boolean;
  paymentIntent: PaymentIntent;
};

export type ProtectedContentResponse = {
  ok: boolean;
  content: {
    resourceId: string;
    title: string;
    resourceUrl: string;
    openUrl: string;
    deliveredVia: "x402-access-layer";
  };
};

export type WalletState = {
  address: string | null;
  connected: boolean;
};
