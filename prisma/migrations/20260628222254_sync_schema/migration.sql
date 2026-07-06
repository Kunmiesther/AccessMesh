-- Additive-only sync migration.
-- The previous version of this migration redefined tables and used DROP TABLE,
-- which is not acceptable for preserving production data.

CREATE INDEX IF NOT EXISTS "Payment_payerWallet_idx" ON "Payment"("payerWallet");
CREATE INDEX IF NOT EXISTS "Payment_providerWallet_idx" ON "Payment"("providerWallet");
CREATE INDEX IF NOT EXISTS "Payment_resourceId_idx" ON "Payment"("resourceId");
CREATE INDEX IF NOT EXISTS "Resource_creatorWallet_idx" ON "Resource"("creatorWallet");
CREATE INDEX IF NOT EXISTS "Resource_createdAt_idx" ON "Resource"("createdAt");
