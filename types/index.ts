export type ResourceType = "API" | "CONTENT" | "TOOL" | "DATASET";
export type PublishedResourceType = "ARTICLE" | "FILE_UPLOAD" | "EXTERNAL_LINK";
export type UnlockAdvisorRecommendation = "BUY" | "CONSIDER" | "SKIP";
export type UnlockAdvisorDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type ActivityEventType =
  | "RESOURCE_PUBLISHED"
  | "RESOURCE_UNLOCKED"
  | "PROTECTED_RESOURCE_ACCESSED"
  | "BRIDGE_STARTED"
  | "BRIDGE_COMPLETED"
  | "BRIDGE_FAILED";

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
  previewText?: string | null;
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
  bridges: BridgeAnalytics;
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

export type PaymentRequiredMetadata = {
  url: string;
  price: string;
  currency: "USDC";
  network: "Arc Testnet";
};

export type PaymentRequiredResourceMetadata = {
  title?: string;
  summary?: string;
  creator?: string;
  category?: string;
  topics?: string[];
  difficulty?: string;
  estimatedAudience?: string;
  qualityScore?: string;
  agentReasoningHint?: string;
};

export type PaymentRequiredAgentMetadata = {
  decisionContext: string;
  retryAfterPayment: boolean;
};

export type PaymentRequiredRetryMetadata = {
  method: "GET";
  headers?: {
    "x-accessmesh-wallet": string;
  };
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
      resource: ResourceDetail & PaymentRequiredResourceMetadata;
      accepts: X402Accept[];
      x402: X402PaymentRequired;
      accessRequired: X402AccessRequired;
      payment?: PaymentRequiredMetadata;
      agent?: PaymentRequiredAgentMetadata;
      retry?: PaymentRequiredRetryMetadata;
    };

export type UnlockAdvisorResult = {
  recommendation: UnlockAdvisorRecommendation;
  confidence: number;
  valueScore: number;
  difficulty: UnlockAdvisorDifficulty;
  bestFor: string[];
  reason: string;
  possibleOverlap: string;
  priceAssessment: string;
  agentDecisionSummary: string;
};

export type UnlockAdvisorResponse =
  | {
      ok: true;
      advisor: UnlockAdvisorResult;
    }
  | {
      ok: false;
      message: string;
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

export type BridgeStatus = "STARTED" | "COMPLETED" | "FAILED";

export type BridgeActivityEntry = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  payerWallet: string;
  sourceWallet: string;
  sourceChain: string;
  destinationChain: string;
  amountUSDC: number;
  feeUSDC: number | null;
  totalBurnUSDC: number | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  status: BridgeStatus;
  errorMessage: string | null;
  timestamp: string;
};

export type BridgeAnalytics = {
  totalBridgedVolume: number;
  numberOfBridges: number;
  successfulBridges: number;
  failedBridges: number;
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
  crossChainActivity: BridgeActivityEntry[];
  protocolActivity: RecentActivityEntry[];
  recentUnlocks: RecentActivityEntry[];
  recentPublications: RecentActivityEntry[];
};

export type CctpBridgeRecordRequest =
  | {
      event: "started";
      resourceId: string;
      payerWallet: string;
      sourceWallet: string;
      sourceChain: {
        name: string;
        chainId: number;
        domain: number;
      };
      destinationChain: {
        name: string;
        chainId: number;
        domain: number;
      };
      amountUSDC: number;
      feeUSDC?: number | null;
      totalBurnUSDC?: number | null;
      sourceTxHash: string;
    }
  | {
      event: "completed";
      sourceTxHash: string;
      destinationTxHash: string;
      payerWallet: string;
    }
  | {
      event: "failed";
      sourceTxHash: string;
      payerWallet: string;
      errorMessage: string;
    };

export type CctpBridgeRecordResponse = {
  ok: boolean;
  bridge: BridgeActivityEntry;
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
