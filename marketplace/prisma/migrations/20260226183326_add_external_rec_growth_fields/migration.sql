-- AlterTable
ALTER TABLE "external_recommendations" ADD COLUMN     "potentialLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "external_recommendations_potentialLead_idx" ON "external_recommendations"("potentialLead");
