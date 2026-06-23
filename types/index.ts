// Resource types
export type ResourceType = "API" | "CONTENT" | "TOOL" | "DATASET";

export type ResourceMeta = {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
};

// Payment intent — returned by GET /api/access/[id]
export type PaymentIntent = {
  accessId: string;
  amountUSDC: number;
  recipientWallet: string;
  expiresAt: string;
  payerWallet: string;
  resource: ResourceMeta;
  payment: unknown; // Circle send requirement — passed through to Arc SDK
};

export type AccessIntentResponse = {
  ok: boolean;
  paymentIntent: PaymentIntent;
};

// Unlock — POST /api/access/unlock
export type UnlockRequest = {
  accessId: string;
  txHash: string;
};

export type UnlockResponse = {
  ok: boolean;
  access: "UNLOCKED" | "LOCKED";
  accessToken?: string;
  tokenType?: string;
  expiresAt?: string;
  resourceId?: string;
  txHash?: string;
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

// Payment initiate — POST /api/payment/initiate
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

// Payment verify — POST /api/payment/verify
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

// Ledger — GET /api/ledger
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

// Wallet state
export type WalletState = {
  address: string | null;
  connected: boolean;
};