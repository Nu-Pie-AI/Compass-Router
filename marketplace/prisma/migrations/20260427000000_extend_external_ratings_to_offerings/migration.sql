-- Extend external ratings so records can belong to either legacy products or active offerings.
ALTER TABLE "external_ratings" ADD COLUMN "offeringId" TEXT;

ALTER TABLE "external_ratings" ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "external_ratings"
  ADD CONSTRAINT "external_ratings_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "external_ratings_offeringId_source_key" ON "external_ratings"("offeringId", "source");

CREATE INDEX "external_ratings_offeringId_idx" ON "external_ratings"("offeringId");

ALTER TABLE "external_ratings"
  ADD CONSTRAINT "external_ratings_single_owner_check"
  CHECK (
    ("productId" IS NOT NULL AND "offeringId" IS NULL)
    OR
    ("productId" IS NULL AND "offeringId" IS NOT NULL)
  );

ALTER TABLE "offering_clicks" ADD COLUMN "clickType" TEXT;
