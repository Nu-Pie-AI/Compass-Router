-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('SOFTWARE_VENDOR', 'SERVICE_PROVIDER', 'CONSULTING_FIRM', 'SYSTEM_INTEGRATOR', 'HYBRID');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SOFTWARE_PRODUCT', 'PROFESSIONAL_SERVICE', 'IMPLEMENTATION', 'TRAINING', 'MANAGED_SERVICE');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('TEXT', 'MULTI_SELECT', 'SINGLE_SELECT', 'TEXT_WITH_SECTION', 'MAIN_WITH_SUB');

-- CreateEnum
CREATE TYPE "RatingSource" AS ENUM ('G2', 'CAPTERRA', 'TRUSTPILOT', 'GOOGLE', 'SOFTWARE_ADVICE', 'GARTNER');

-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('PRODUCT', 'SERVICE', 'IMPLEMENTATION', 'TRAINING', 'MANAGED_SERVICE');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OnboardingMode" AS ENUM ('SELF_INITIATED', 'ADMIN_INITIATED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shortDescription" VARCHAR(500),
    "logo" TEXT,
    "videoUrl" TEXT,
    "website" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "companyName" TEXT,
    "companySize" TEXT,
    "founded" TEXT,
    "headquarters" TEXT,
    "pricingModel" TEXT,
    "startingPrice" DOUBLE PRECISION,
    "hasFreeTrial" BOOLEAN NOT NULL DEFAULT false,
    "freeTrialDays" INTEGER,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "vendorId" TEXT,
    "search_vector" tsvector,
    "approvalStatus" TEXT NOT NULL DEFAULT 'not_submitted',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "revisionNotes" TEXT,
    "revisionRequested" BOOLEAN NOT NULL DEFAULT false,
    "submittedForApprovalAt" TIMESTAMP(3),
    "listingType" "ListingType" NOT NULL DEFAULT 'SOFTWARE_PRODUCT',
    "primaryFunction" TEXT,
    "smbFriendly" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "changes" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_status_history" (
    "id" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeringId" TEXT,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeringId" TEXT,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "billingCycle" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" TEXT[],
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeringId" TEXT,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pros" TEXT,
    "cons" TEXT,
    "userRole" TEXT,
    "companySize" TEXT,
    "industry" TEXT,
    "usageDuration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moderatedAt" TIMESTAMP(3),
    "moderatedBy" TEXT,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "offeringId" TEXT,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_votes" (
    "id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "verificationDocuments" TEXT[],
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "approvalNotes" TEXT,
    "approvedBy" TEXT,
    "canReapplyAt" TIMESTAMP(3),
    "draftProducts" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingProducts" INTEGER NOT NULL DEFAULT 0,
    "publishedProducts" INTEGER NOT NULL DEFAULT 0,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspensionReason" TEXT,
    "providerType" "ProviderType" NOT NULL DEFAULT 'SOFTWARE_VENDOR',

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_status_history" (
    "id" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "vendor_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_analytics" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "context" JSONB,
    "userId" TEXT,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_onboarding_questions" (
    "id" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "subQuestionId" TEXT,
    "category" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerType" "AnswerType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_onboarding_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_onboarding_answers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_onboarding_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_clicks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "product_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_ratings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "RatingSource" NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "providerType" "ProviderType" NOT NULL DEFAULT 'SOFTWARE_VENDOR',
    "website" TEXT,
    "linkedInUrl" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "regions" TEXT[],
    "complianceFlags" TEXT[],
    "aiExtracted" BOOLEAN NOT NULL DEFAULT false,
    "scrapedAt" TIMESTAMP(3),
    "scrapedContent" JSONB,
    "overallConfidence" DOUBLE PRECISION,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "totalOfferings" INTEGER NOT NULL DEFAULT 0,
    "publishedOfferings" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardedBy" TEXT,
    "onboardingMode" "OnboardingMode",
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" VARCHAR(500),
    "description" TEXT,
    "logo" TEXT,
    "videoUrl" TEXT,
    "website" TEXT,
    "offeringType" "OfferingType" NOT NULL,
    "primaryFunction" TEXT NOT NULL,
    "subCategory" TEXT,
    "useCases" TEXT[],
    "painPointsSolved" TEXT[],
    "integrations" TEXT[],
    "complianceFlags" TEXT[],
    "learningCurve" TEXT,
    "implementationTime" TEXT,
    "icpTeamSize" TEXT,
    "icpIndustry" TEXT[],
    "icpCompanyStage" TEXT,
    "icpBudget" TEXT,
    "pricingModel" TEXT,
    "startingPrice" DOUBLE PRECISION,
    "hasFreeTrial" BOOLEAN NOT NULL DEFAULT false,
    "freeTrialDays" INTEGER,
    "regions" TEXT[],
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "confidenceScore" DOUBLE PRECISION,
    "fieldConfidence" JSONB,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvalStatus" TEXT NOT NULL DEFAULT 'not_submitted',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_enrichment_answers" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "confidenceBoost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_enrichment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_views" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_clicks" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "offering_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_status_history" (
    "id" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeringId" TEXT NOT NULL,

    CONSTRAINT "offering_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "userId" TEXT,
    "offeringId" TEXT,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_status_history" (
    "id" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "partner_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CategoryToOffering" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToOffering_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_featured_idx" ON "products"("featured");

-- CreateIndex
CREATE INDEX "products_averageRating_idx" ON "products"("averageRating");

-- CreateIndex
CREATE INDEX "products_vendorId_idx" ON "products"("vendorId");

-- CreateIndex
CREATE INDEX "products_approvalStatus_idx" ON "products"("approvalStatus");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "product_versions_productId_idx" ON "product_versions"("productId");

-- CreateIndex
CREATE INDEX "product_status_history_productId_idx" ON "product_status_history"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_featured_idx" ON "categories"("featured");

-- CreateIndex
CREATE INDEX "screenshots_productId_idx" ON "screenshots"("productId");

-- CreateIndex
CREATE INDEX "screenshots_offeringId_idx" ON "screenshots"("offeringId");

-- CreateIndex
CREATE INDEX "features_productId_idx" ON "features"("productId");

-- CreateIndex
CREATE INDEX "features_offeringId_idx" ON "features"("offeringId");

-- CreateIndex
CREATE INDEX "pricing_plans_productId_idx" ON "pricing_plans"("productId");

-- CreateIndex
CREATE INDEX "pricing_plans_offeringId_idx" ON "pricing_plans"("offeringId");

-- CreateIndex
CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");

-- CreateIndex
CREATE INDEX "reviews_offeringId_idx" ON "reviews"("offeringId");

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt");

-- CreateIndex
CREATE INDEX "review_votes_reviewId_idx" ON "review_votes"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "review_votes_userId_reviewId_key" ON "review_votes"("userId", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_userId_key" ON "vendors"("userId");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "vendors_userId_idx" ON "vendors"("userId");

-- CreateIndex
CREATE INDEX "vendor_status_history_vendorId_idx" ON "vendor_status_history"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_contacts_productId_idx" ON "vendor_contacts"("productId");

-- CreateIndex
CREATE INDEX "vendor_contacts_vendorId_idx" ON "vendor_contacts"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_contacts_status_idx" ON "vendor_contacts"("status");

-- CreateIndex
CREATE INDEX "vendor_contacts_createdAt_idx" ON "vendor_contacts"("createdAt");

-- CreateIndex
CREATE INDEX "search_analytics_query_idx" ON "search_analytics"("query");

-- CreateIndex
CREATE INDEX "search_analytics_createdAt_idx" ON "search_analytics"("createdAt");

-- CreateIndex
CREATE INDEX "product_views_productId_idx" ON "product_views"("productId");

-- CreateIndex
CREATE INDEX "product_views_userId_idx" ON "product_views"("userId");

-- CreateIndex
CREATE INDEX "product_views_createdAt_idx" ON "product_views"("createdAt");

-- CreateIndex
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");

-- CreateIndex
CREATE INDEX "chat_conversations_sessionId_idx" ON "chat_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "chat_conversations_createdAt_idx" ON "chat_conversations"("createdAt");

-- CreateIndex
CREATE INDEX "product_onboarding_questions_category_idx" ON "product_onboarding_questions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "product_onboarding_questions_questionNumber_subQuestionId_key" ON "product_onboarding_questions"("questionNumber", "subQuestionId");

-- CreateIndex
CREATE INDEX "product_onboarding_answers_productId_idx" ON "product_onboarding_answers"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_onboarding_answers_productId_questionId_key" ON "product_onboarding_answers"("productId", "questionId");

-- CreateIndex
CREATE INDEX "product_clicks_productId_idx" ON "product_clicks"("productId");

-- CreateIndex
CREATE INDEX "product_clicks_sessionId_idx" ON "product_clicks"("sessionId");

-- CreateIndex
CREATE INDEX "product_clicks_clickedAt_idx" ON "product_clicks"("clickedAt");

-- CreateIndex
CREATE INDEX "external_ratings_productId_idx" ON "external_ratings"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "external_ratings_productId_source_key" ON "external_ratings"("productId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "partners_userId_key" ON "partners"("userId");

-- CreateIndex
CREATE INDEX "partners_status_idx" ON "partners"("status");

-- CreateIndex
CREATE INDEX "partners_providerType_idx" ON "partners"("providerType");

-- CreateIndex
CREATE INDEX "partners_onboardingStatus_idx" ON "partners"("onboardingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_slug_key" ON "offerings"("slug");

-- CreateIndex
CREATE INDEX "offerings_slug_idx" ON "offerings"("slug");

-- CreateIndex
CREATE INDEX "offerings_status_idx" ON "offerings"("status");

-- CreateIndex
CREATE INDEX "offerings_partnerId_idx" ON "offerings"("partnerId");

-- CreateIndex
CREATE INDEX "offerings_offeringType_idx" ON "offerings"("offeringType");

-- CreateIndex
CREATE INDEX "offerings_primaryFunction_idx" ON "offerings"("primaryFunction");

-- CreateIndex
CREATE INDEX "offerings_confidenceScore_idx" ON "offerings"("confidenceScore");

-- CreateIndex
CREATE INDEX "offering_enrichment_answers_offeringId_idx" ON "offering_enrichment_answers"("offeringId");

-- CreateIndex
CREATE INDEX "offering_views_offeringId_idx" ON "offering_views"("offeringId");

-- CreateIndex
CREATE INDEX "offering_views_userId_idx" ON "offering_views"("userId");

-- CreateIndex
CREATE INDEX "offering_views_createdAt_idx" ON "offering_views"("createdAt");

-- CreateIndex
CREATE INDEX "offering_clicks_offeringId_idx" ON "offering_clicks"("offeringId");

-- CreateIndex
CREATE INDEX "offering_clicks_sessionId_idx" ON "offering_clicks"("sessionId");

-- CreateIndex
CREATE INDEX "offering_clicks_clickedAt_idx" ON "offering_clicks"("clickedAt");

-- CreateIndex
CREATE INDEX "offering_status_history_offeringId_idx" ON "offering_status_history"("offeringId");

-- CreateIndex
CREATE INDEX "partner_contacts_offeringId_idx" ON "partner_contacts"("offeringId");

-- CreateIndex
CREATE INDEX "partner_contacts_partnerId_idx" ON "partner_contacts"("partnerId");

-- CreateIndex
CREATE INDEX "partner_contacts_status_idx" ON "partner_contacts"("status");

-- CreateIndex
CREATE INDEX "partner_status_history_partnerId_idx" ON "partner_status_history"("partnerId");

-- CreateIndex
CREATE INDEX "_CategoryToOffering_B_index" ON "_CategoryToOffering"("B");

-- CreateIndex
CREATE INDEX "_CategoryToProduct_B_index" ON "_CategoryToProduct"("B");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_status_history" ADD CONSTRAINT "product_status_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_status_history" ADD CONSTRAINT "vendor_status_history_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboarding_answers" ADD CONSTRAINT "product_onboarding_answers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_onboarding_answers" ADD CONSTRAINT "product_onboarding_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "product_onboarding_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_clicks" ADD CONSTRAINT "product_clicks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_clicks" ADD CONSTRAINT "product_clicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_ratings" ADD CONSTRAINT "external_ratings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_enrichment_answers" ADD CONSTRAINT "offering_enrichment_answers_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_views" ADD CONSTRAINT "offering_views_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_views" ADD CONSTRAINT "offering_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_clicks" ADD CONSTRAINT "offering_clicks_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_clicks" ADD CONSTRAINT "offering_clicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_status_history" ADD CONSTRAINT "offering_status_history_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_status_history" ADD CONSTRAINT "partner_status_history_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToOffering" ADD CONSTRAINT "_CategoryToOffering_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToOffering" ADD CONSTRAINT "_CategoryToOffering_B_fkey" FOREIGN KEY ("B") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToProduct" ADD CONSTRAINT "_CategoryToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToProduct" ADD CONSTRAINT "_CategoryToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
