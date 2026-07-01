CREATE TABLE IF NOT EXISTS "CctpBridge" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CctpBridge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CctpBridge_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CctpBridge_sourceTxHash_key" ON "CctpBridge"("sourceTxHash");
CREATE INDEX IF NOT EXISTS "CctpBridge_payerWallet_idx" ON "CctpBridge"("payerWallet");
CREATE INDEX IF NOT EXISTS "CctpBridge_sourceWallet_idx" ON "CctpBridge"("sourceWallet");
CREATE INDEX IF NOT EXISTS "CctpBridge_resourceId_idx" ON "CctpBridge"("resourceId");
CREATE INDEX IF NOT EXISTS "CctpBridge_status_idx" ON "CctpBridge"("status");
CREATE INDEX IF NOT EXISTS "CctpBridge_createdAt_idx" ON "CctpBridge"("createdAt");
