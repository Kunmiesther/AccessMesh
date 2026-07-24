-- Resource publishing metadata
ALTER TABLE "Resource" ADD COLUMN "creatorWallet" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Resource" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Resource" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'CONTENT';
ALTER TABLE "Resource" ADD COLUMN "resourceUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Resource" ADD COLUMN "coverImage" TEXT;
ALTER TABLE "Resource" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Resource" ADD COLUMN "unlockCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Resource"
SET
  "title" = CASE WHEN "title" = '' THEN "name" ELSE "title" END,
  "category" = CASE WHEN "category" = 'CONTENT' THEN "type" ELSE "category" END,
  "resourceUrl" = CASE WHEN "resourceUrl" = '' THEN "endpoint" ELSE "resourceUrl" END;

-- Purchasing and activity records
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "buyerWallet" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "amountUSDC" REAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "X402AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "X402AccessLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Purchase_txHash_key" ON "Purchase"("txHash");
CREATE UNIQUE INDEX "Purchase_resourceId_buyerWallet_key" ON "Purchase"("resourceId", "buyerWallet");
CREATE INDEX "Purchase_buyerWallet_idx" ON "Purchase"("buyerWallet");
CREATE INDEX "Purchase_creatorWallet_idx" ON "Purchase"("creatorWallet");
CREATE INDEX "Purchase_resourceId_idx" ON "Purchase"("resourceId");
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
CREATE INDEX "ActivityEvent_wallet_idx" ON "ActivityEvent"("wallet");
CREATE INDEX "ActivityEvent_resourceId_idx" ON "ActivityEvent"("resourceId");

CREATE INDEX "X402AccessLog_wallet_idx" ON "X402AccessLog"("wallet");
CREATE INDEX "X402AccessLog_resourceId_idx" ON "X402AccessLog"("resourceId");
CREATE INDEX "X402AccessLog_createdAt_idx" ON "X402AccessLog"("createdAt");

CREATE INDEX "Resource_creatorWallet_idx" ON "Resource"("creatorWallet");
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");
