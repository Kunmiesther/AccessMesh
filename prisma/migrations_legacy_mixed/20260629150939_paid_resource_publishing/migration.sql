ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "publishTxHash" TEXT;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "publishFeeUSDC" DOUBLE PRECISION;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Resource_publishTxHash_key" ON "Resource"("publishTxHash");
CREATE INDEX IF NOT EXISTS "Resource_publishedAt_idx" ON "Resource"("publishedAt");
