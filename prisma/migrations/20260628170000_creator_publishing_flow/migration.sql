ALTER TABLE "Resource" ADD COLUMN "creatorDisplayName" TEXT;
ALTER TABLE "Resource" ADD COLUMN "resourceCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Resource" ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Resource" ADD COLUMN "resourceContent" TEXT NOT NULL DEFAULT '';
