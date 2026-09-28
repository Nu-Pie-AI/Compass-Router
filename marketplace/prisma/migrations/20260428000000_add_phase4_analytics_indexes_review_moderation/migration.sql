ALTER TABLE "reviews" ADD COLUMN "moderationReason" TEXT;

CREATE INDEX "reviews_offeringId_status_createdAt_idx" ON "reviews"("offeringId", "status", "createdAt");
CREATE INDEX "reviews_productId_status_createdAt_idx" ON "reviews"("productId", "status", "createdAt");

CREATE INDEX "offering_views_offeringId_createdAt_idx" ON "offering_views"("offeringId", "createdAt");
CREATE INDEX "offering_views_sessionId_idx" ON "offering_views"("sessionId");

CREATE INDEX "offering_clicks_offeringId_clickedAt_idx" ON "offering_clicks"("offeringId", "clickedAt");

CREATE INDEX "partner_contacts_partnerId_createdAt_idx" ON "partner_contacts"("partnerId", "createdAt");
CREATE INDEX "partner_contacts_offeringId_createdAt_idx" ON "partner_contacts"("offeringId", "createdAt");
