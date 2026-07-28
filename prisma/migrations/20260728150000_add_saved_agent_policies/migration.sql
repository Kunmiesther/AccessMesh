-- Add saved policy support for AccessMesh agents.

ALTER TABLE "Agent"
ADD COLUMN "defaultPolicyId" TEXT;

ALTER TABLE "AgentPolicy"
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Balanced Buyer';

ALTER TABLE "AgentPolicy"
ADD COLUMN "description" TEXT;

ALTER TABLE "AgentPolicy"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "AgentPolicy"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AgentPolicy"
ADD COLUMN "manualApprovalRequired" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AgentPolicy"
ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Agent"
SET "defaultPolicyId" = policy."id"
FROM "AgentPolicy" AS policy
WHERE policy."agentId" = "Agent"."id";

DROP INDEX IF EXISTS "AgentPolicy_agentId_key";

CREATE UNIQUE INDEX "AgentPolicy_agentId_name_key" ON "AgentPolicy"("agentId", "name");
CREATE INDEX "AgentPolicy_agentId_idx" ON "AgentPolicy"("agentId");
CREATE INDEX "AgentPolicy_agentId_status_idx" ON "AgentPolicy"("agentId", "status");
CREATE INDEX "AgentPolicy_agentId_archivedAt_idx" ON "AgentPolicy"("agentId", "archivedAt");
CREATE INDEX "AgentPolicy_createdAt_idx" ON "AgentPolicy"("createdAt");

CREATE UNIQUE INDEX "Agent_defaultPolicyId_key" ON "Agent"("defaultPolicyId");

ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_defaultPolicyId_fkey"
FOREIGN KEY ("defaultPolicyId") REFERENCES "AgentPolicy"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

