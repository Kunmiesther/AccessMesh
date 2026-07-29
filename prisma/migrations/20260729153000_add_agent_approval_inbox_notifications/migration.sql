-- Add owner-scoped approval inbox and notification persistence for AccessMesh agent executions.

CREATE TABLE "AgentExecutionApproval" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExecutionApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentExecutionApproval_executionId_key" ON "AgentExecutionApproval"("executionId");
CREATE INDEX "AgentExecutionApproval_ownerId_status_createdAt_idx" ON "AgentExecutionApproval"("ownerId", "status", "createdAt");
CREATE INDEX "AgentExecutionApproval_ownerId_decidedAt_idx" ON "AgentExecutionApproval"("ownerId", "decidedAt");

ALTER TABLE "AgentExecutionApproval"
ADD CONSTRAINT "AgentExecutionApproval_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "AgentExecution"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentExecutionApproval"
ADD CONSTRAINT "AgentExecutionApproval_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AgentNotification" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actionPath" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentNotification_dedupeKey_key" ON "AgentNotification"("dedupeKey");
CREATE INDEX "AgentNotification_ownerId_readAt_createdAt_idx" ON "AgentNotification"("ownerId", "readAt", "createdAt");
CREATE INDEX "AgentNotification_ownerId_createdAt_idx" ON "AgentNotification"("ownerId", "createdAt");

ALTER TABLE "AgentNotification"
ADD CONSTRAINT "AgentNotification_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
