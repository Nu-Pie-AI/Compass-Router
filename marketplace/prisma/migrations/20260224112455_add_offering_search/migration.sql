-- AlterTable
ALTER TABLE "offerings" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "offerings_search_vector_idx" ON "offerings" USING GIN ("search_vector");
