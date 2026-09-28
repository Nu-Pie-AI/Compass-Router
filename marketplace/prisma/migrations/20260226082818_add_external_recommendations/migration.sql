-- CreateTable
CREATE TABLE "external_recommendations" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productUrl" TEXT,
    "category" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai_generated',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_recommendations_conversationId_idx" ON "external_recommendations"("conversationId");

-- CreateIndex
CREATE INDEX "external_recommendations_category_idx" ON "external_recommendations"("category");

-- CreateIndex
CREATE INDEX "external_recommendations_createdAt_idx" ON "external_recommendations"("createdAt");

-- AddForeignKey
ALTER TABLE "external_recommendations" ADD CONSTRAINT "external_recommendations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
