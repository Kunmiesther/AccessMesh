-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL DEFAULT '',
    "creatorDisplayName" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CONTENT',
    "type" TEXT NOT NULL,
    "resourceCategory" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceContent" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "priceUSDC" DOUBLE PRECISION NOT NULL,
    "resourceUrl" TEXT NOT NULL DEFAULT '',
    "endpoint" TEXT NOT NULL,
    "coverImage" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "unlockCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishTxHash" TEXT,
    "publishFeeUSDC" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "aiSummary" TEXT,
    "aiTopics" TEXT,
    "aiCategory" TEXT,
    "aiAudience" TEXT,
    "aiCollection" TEXT,
    "aiPlacement" TEXT,
    "aiRelatedResourceIds" TEXT,
    "aiReasoning" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "providerWallet" TEXT NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "buyerWallet" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CctpBridge" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "sourceWallet" TEXT NOT NULL,
    "sourceChain" TEXT NOT NULL,
    "sourceChainId" INTEGER NOT NULL,
    "sourceDomain" INTEGER NOT NULL,
    "destinationChain" TEXT NOT NULL,
    "destinationChainId" INTEGER NOT NULL,
    "destinationDomain" INTEGER NOT NULL,
    "amountUSDC" DOUBLE PRECISION NOT NULL,
    "feeUSDC" DOUBLE PRECISION,
    "totalBurnUSDC" DOUBLE PRECISION,
    "sourceTxHash" TEXT,
    "destinationTxHash" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CctpBridge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "X402AccessLog" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "X402AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_publishTxHash_key" ON "Resource"("publishTxHash");

-- CreateIndex
CREATE INDEX "Resource_creatorWallet_idx" ON "Resource"("creatorWallet");

-- CreateIndex
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");

-- CreateIndex
CREATE INDEX "Resource_publishedAt_idx" ON "Resource"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txHash_key" ON "Payment"("txHash");

-- CreateIndex
CREATE INDEX "Payment_payerWallet_idx" ON "Payment"("payerWallet");

-- CreateIndex
CREATE INDEX "Payment_providerWallet_idx" ON "Payment"("providerWallet");

-- CreateIndex
CREATE INDEX "Payment_resourceId_idx" ON "Payment"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_txHash_key" ON "Purchase"("txHash");

-- CreateIndex
CREATE INDEX "Purchase_buyerWallet_idx" ON "Purchase"("buyerWallet");

-- CreateIndex
CREATE INDEX "Purchase_creatorWallet_idx" ON "Purchase"("creatorWallet");

-- CreateIndex
CREATE INDEX "Purchase_resourceId_idx" ON "Purchase"("resourceId");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_resourceId_buyerWallet_key" ON "Purchase"("resourceId", "buyerWallet");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_wallet_idx" ON "ActivityEvent"("wallet");

-- CreateIndex
CREATE INDEX "ActivityEvent_resourceId_idx" ON "ActivityEvent"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CctpBridge_sourceTxHash_key" ON "CctpBridge"("sourceTxHash");

-- CreateIndex
CREATE INDEX "CctpBridge_payerWallet_idx" ON "CctpBridge"("payerWallet");

-- CreateIndex
CREATE INDEX "CctpBridge_sourceWallet_idx" ON "CctpBridge"("sourceWallet");

-- CreateIndex
CREATE INDEX "CctpBridge_resourceId_idx" ON "CctpBridge"("resourceId");

-- CreateIndex
CREATE INDEX "CctpBridge_status_idx" ON "CctpBridge"("status");

-- CreateIndex
CREATE INDEX "CctpBridge_createdAt_idx" ON "CctpBridge"("createdAt");

-- CreateIndex
CREATE INDEX "X402AccessLog_wallet_idx" ON "X402AccessLog"("wallet");

-- CreateIndex
CREATE INDEX "X402AccessLog_resourceId_idx" ON "X402AccessLog"("resourceId");

-- CreateIndex
CREATE INDEX "X402AccessLog_createdAt_idx" ON "X402AccessLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CctpBridge" ADD CONSTRAINT "CctpBridge_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "X402AccessLog" ADD CONSTRAINT "X402AccessLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
