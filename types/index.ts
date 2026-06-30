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
  creatorDisplayName: string | null;
  title: string;
  name: string;
  description: string;
  category: ResourceType;
  type: ResourceType;
  resourceCategory: string;
  resourceType: PublishedResourceType | null;
  resourceContent?: string;
  priceUSDC: number;
  resourceUrl?: string;
  endpoint?: string;
  coverImage?: string | null;
  tags: string[];
  unlockCount: number;
  isActive: boolean;
  publishTxHash: string | null;
  publishFeeUSDC: number | null;
  publishedAt: string | null;
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
  creatorDisplayName: string | null;
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

export type UnlockVerification = {
  status: "SETTLED" | "CONFIRMING" | "FAILED";
  settled: boolean;
  reason?: string;
  txHash: string;
};

export type UnlockResponse =
  | {
      ok: true;
      access: "UNLOCKED";
      expiresAt: string;
      resourceId: string;
      resource: ResourceMeta;
      txHash: string;
      purchase: PurchaseProof;
      verification: UnlockVerification;
    }
  | {
      ok: false;
      access: "UNLOCKED" | "LOCKED";
      payment?: {
        id: string;
        status: string;
        txHash: string;
      };
      verification: UnlockVerification;
    };

export type PaymentInitiateRequest = {
  resourceId: string;
  wallet: string;
};

export type PaymentRequirement = {
  resourceId: string;
  amountUSDC: number;
  recipientWallet: string;
  resource: ResourceMeta;
  payerWallet: string;
  providerWallet: string;
  creatorWallet: string;
  treasuryWallet: string;
  creatorAmountUSDC: number;
  treasuryAmountUSDC: number;
  amount: number;
  currency: "USDC";
  chain: string;
  alreadySettled: boolean;
  settledTxHash: string | null;
  payment: unknown;
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
  publishTxHash: string;
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

export type PublishFeeConfig = {
  publishFeeUSDC: number;
  treasuryWallet: string;
};

export type PublishFeeConfigResponse = {
  ok: boolean;
  config: PublishFeeConfig;
};

export type X402Accept = {
  scheme: string;
  price: string;
  network: string;
  payTo: string;
};

export type X402PaymentRequired = {
  x402Version: number;
  accepts: X402Accept[];
  description: string;
  mimeType: string;
  resource: string;
  unlockUrl: string;
};

export type X402AccessRequired = {
  resourceId: string;
  wallet: string | null;
  unlockUrl: string;
};

export type ProtectedResourceResponse =
  | {
      ok: true;
      resource: ResourceDetail;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      resource: ResourceDetail;
      accepts: X402Accept[];
      x402: X402PaymentRequired;
      accessRequired: X402AccessRequired;
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
  creatorWallet: string;
  creatorDisplayName: string | null;
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

export type CreatorProfile = {
  wallet: string;
  displayName: string | null;
  joinDate: string;
  resourcesPublished: number;
  revenueEarned: number;
  unlockCount: number;
  topResource: CreatedResourceSummary | null;
  resources: CreatedResourceSummary[];
};

export type CreatorProfileResponse = {
  ok: boolean;
  creator: CreatorProfile;
};

export type DashboardResponse = {
  ok: boolean;
  stats?: ProtocolStats;
  analytics: CreatorAnalytics;
  purchasedResources: PurchaseProof[];
  createdResources: CreatedResourceSummary[];
  paymentHistory: PurchaseProof[];
  protocolActivity: RecentActivityEntry[];
  recentUnlocks: RecentActivityEntry[];
  recentPublications: RecentActivityEntry[];
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
