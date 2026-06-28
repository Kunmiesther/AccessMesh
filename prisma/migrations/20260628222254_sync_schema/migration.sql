-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "providerWallet" TEXT NOT NULL,
    "amountUSDC" REAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amountUSDC", "createdAt", "id", "payerWallet", "providerWallet", "resourceId", "status", "txHash") SELECT "amountUSDC", "createdAt", "id", "payerWallet", "providerWallet", "resourceId", "status", "txHash" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_txHash_key" ON "Payment"("txHash");
CREATE INDEX "Payment_payerWallet_idx" ON "Payment"("payerWallet");
CREATE INDEX "Payment_providerWallet_idx" ON "Payment"("providerWallet");
CREATE INDEX "Payment_resourceId_idx" ON "Payment"("resourceId");
CREATE TABLE "new_Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "priceUSDC" REAL NOT NULL,
    "resourceUrl" TEXT NOT NULL DEFAULT '',
    "endpoint" TEXT NOT NULL,
    "coverImage" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "unlockCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Resource" ("category", "coverImage", "createdAt", "creatorDisplayName", "creatorWallet", "description", "endpoint", "id", "isActive", "name", "ownerId", "priceUSDC", "resourceCategory", "resourceContent", "resourceType", "resourceUrl", "tags", "title", "type", "unlockCount") SELECT "category", "coverImage", "createdAt", "creatorDisplayName", "creatorWallet", "description", "endpoint", "id", "isActive", "name", "ownerId", "priceUSDC", "resourceCategory", "resourceContent", "resourceType", "resourceUrl", "tags", "title", "type", "unlockCount" FROM "Resource";
DROP TABLE "Resource";
ALTER TABLE "new_Resource" RENAME TO "Resource";
CREATE INDEX "Resource_creatorWallet_idx" ON "Resource"("creatorWallet");
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
