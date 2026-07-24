ALTER TABLE "Resource"
ADD COLUMN "aiSummary" TEXT,
ADD COLUMN "aiTopics" TEXT,
ADD COLUMN "aiCategory" TEXT,
ADD COLUMN "aiAudience" TEXT,
ADD COLUMN "aiCollection" TEXT,
ADD COLUMN "aiPlacement" TEXT,
ADD COLUMN "aiRelatedResourceIds" TEXT,
ADD COLUMN "aiReasoning" TEXT,
ADD COLUMN "aiAnalyzedAt" TIMESTAMP(3);
