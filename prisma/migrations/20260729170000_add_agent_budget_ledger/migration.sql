-- Add transaction-safe consumable budget ledger for AccessMesh agent executions.

CREATE TABLE "AgentBudgetBucket" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "limitMicros" BIGINT NOT NULL,
    "committedMicros" BIGINT NOT NULL DEFAULT 0,
    "reservedMicros" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBudgetBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentBudgetReservation" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "amountMicros" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBudgetReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentBudgetLedgerEntry" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "executionId" TEXT,
    "reservationId" TEXT,
    "type" TEXT NOT NULL,
    "amountMicros" BIGINT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentBudgetLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentBudgetBucket_policyId_periodType_periodStart_key" ON "AgentBudgetBucket"("policyId", "periodType", "periodStart");
CREATE INDEX "AgentBudgetBucket_ownerId_periodStart_periodEnd_idx" ON "AgentBudgetBucket"("ownerId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX "AgentBudgetReservation_executionId_key" ON "AgentBudgetReservation"("executionId");
CREATE INDEX "AgentBudgetReservation_bucketId_status_idx" ON "AgentBudgetReservation"("bucketId", "status");

CREATE UNIQUE INDEX "AgentBudgetLedgerEntry_dedupeKey_key" ON "AgentBudgetLedgerEntry"("dedupeKey");
CREATE INDEX "AgentBudgetLedgerEntry_bucketId_createdAt_idx" ON "AgentBudgetLedgerEntry"("bucketId", "createdAt");
CREATE INDEX "AgentBudgetLedgerEntry_executionId_idx" ON "AgentBudgetLedgerEntry"("executionId");

ALTER TABLE "AgentBudgetBucket"
ADD CONSTRAINT "AgentBudgetBucket_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentBudgetBucket"
ADD CONSTRAINT "AgentBudgetBucket_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "AgentPolicy"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentBudgetReservation"
ADD CONSTRAINT "AgentBudgetReservation_bucketId_fkey"
FOREIGN KEY ("bucketId") REFERENCES "AgentBudgetBucket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentBudgetReservation"
ADD CONSTRAINT "AgentBudgetReservation_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "AgentExecution"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentBudgetLedgerEntry"
ADD CONSTRAINT "AgentBudgetLedgerEntry_bucketId_fkey"
FOREIGN KEY ("bucketId") REFERENCES "AgentBudgetBucket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
