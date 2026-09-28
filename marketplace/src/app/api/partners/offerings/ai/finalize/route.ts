// ============================================
// API: Finalize Offering (Create in Database)
// Most complex endpoint - atomic transaction
// Creates Offering + Embeddings + EnrichmentAnswers
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { parseQuestionnaireToOffering, extractEnrichmentQA } from '@/lib/ai-onboarding/questionnaire-parser';
import { generateOfferingEmbedding, validateEmbedding } from '@/lib/ai-onboarding/embedding-generator';
import { assignCategoryToOffering } from '@/lib/category-mapper';
import { AIOnboardingContext } from '@/lib/ai-onboarding/types';
import { buildPartnerOnboardingUpdate } from '@/lib/ai-onboarding/partner-onboarding';
import { Prisma } from '@prisma/client';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

const finalizeSchema = z.object({
  sessionId: z.string(),
  forceCreate: z.boolean().optional(), // Create even if low confidence
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate partner
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get partner profile
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    if (!isApprovedPartner(partner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    // Validate request body
    const body = await req.json();
    const { sessionId, forceCreate } = finalizeSchema.parse(body);

    // Fetch conversation
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: sessionId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const context = conversation.context as unknown as AIOnboardingContext;
    const isFirstTimeOnboarding = partner.onboardingStatus !== 'COMPLETED';

    if (!context.questionnaireAnswers) {
      return NextResponse.json(
        { error: 'No questionnaire answers found. Run generate-intelligence first.' },
        { status: 400 }
      );
    }

    // Check confidence score
    if (!forceCreate && (context.confidenceScore || 0) < 60) {
      return NextResponse.json(
        {
          error: 'Confidence score too low',
          message: `Confidence score is ${context.confidenceScore}%. Please answer more questions or use forceCreate flag.`,
          confidenceScore: context.confidenceScore,
        },
        { status: 400 }
      );
    }

    console.log('[Finalize] Starting offering creation...');

    // Parse questionnaire to offering data
    const offeringData = parseQuestionnaireToOffering(
      context.questionnaireAnswers,
      context.offeringName,
      context.offeringSummary
    );

    console.log('[Finalize] Parsed offering data:', {
      title: offeringData.title,
      primaryFunction: offeringData.primaryFunction,
      useCasesCount: offeringData.useCases.length,
      confidenceScore: offeringData.confidenceScore,
    });

    // Generate unique slug
    const baseSlug = offeringData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.offering.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    console.log('[Finalize] Generated slug:', slug);

    // Generate embedding
    console.log('[Finalize] Generating embedding...');
    let embedding: number[] | null = null;
    let embeddingGenerated = false;

    try {
      embedding = await generateOfferingEmbedding(offeringData);
      embeddingGenerated = validateEmbedding(embedding);

      if (!embeddingGenerated) {
        console.warn('[Finalize] Invalid embedding generated, proceeding without it');
        embedding = null;
      }
    } catch (embeddingError) {
      console.error('[Finalize] Embedding generation failed:', embeddingError);
      // Continue without embedding (can be generated later)
      embedding = null;
    }

    // Extract Q&A pairs for enrichment
    const enrichmentQA = extractEnrichmentQA(context.questionnaireAnswers);

    console.log('[Finalize] Extracted', enrichmentQA.length, 'Q&A pairs');

    // Determine status based on confidence
    const status: 'published' | 'pending_review' | 'draft' =
      offeringData.confidenceScore >= 85
        ? 'pending_review'
        : offeringData.confidenceScore >= 70
        ? 'draft'
        : 'draft';

    // Get category ID
    const categoryId = await assignCategoryToOffering(
      prisma,
      offeringData.primaryFunction
    );

    // Atomic transaction: Create offering + enrichment answers
    console.log('[Finalize] Starting database transaction...');

    const offering = await prisma.$transaction(async (tx) => {
      // 1. Create offering
      const newOffering = await tx.offering.create({
        data: {
          slug,
          title: offeringData.title,
          shortDescription: offeringData.shortDescription,
          description: offeringData.description,
          website: context.websiteUrl || null,
          offeringType: offeringData.offeringType,
          primaryFunction: offeringData.primaryFunction,
          subCategory: offeringData.subCategory || null,
          useCases: offeringData.useCases,
          painPointsSolved: offeringData.painPointsSolved,
          integrations: offeringData.integrations,
          complianceFlags: offeringData.complianceFlags,
          icpTeamSize: offeringData.icpTeamSize || null,
          icpIndustry: offeringData.icpIndustry,
          icpCompanyStage: offeringData.icpCompanyStage || null,
          icpBudget: offeringData.icpBudget || null,
          pricingModel: offeringData.pricingModel || null,
          startingPrice: offeringData.startingPrice || null,
          hasFreeTrial: offeringData.hasFreeTrial,
          implementationTime: offeringData.implementationTime || null,
          learningCurve: offeringData.learningCurve || null,
          regions: offeringData.regions,
          embedding: embedding || [],
          confidenceScore: offeringData.confidenceScore,
          fieldConfidence: offeringData.fieldConfidence || {},
          aiGenerated: true,
          humanReviewed: false,
          status,
          partnerId: partner.id,
          // Connect to category if found
          ...(categoryId && {
            categories: {
              connect: { id: categoryId },
            },
          }),
        },
      });

      // 2. Create enrichment answers (all 37 Q&A pairs)
      if (enrichmentQA.length > 0) {
        await tx.offeringEnrichmentAnswer.createMany({
          data: enrichmentQA.map((qa) => ({
            offeringId: newOffering.id,
            question: qa.question,
            answer: qa.answer,
            aiGenerated: true,
            confidenceBoost: qa.confidence ? qa.confidence - 80 : null,
          })),
        });
      }

      // 3. Complete partner onboarding on the first successful offering
      if (isFirstTimeOnboarding) {
        await tx.partner.update({
          where: { id: partner.id },
          data: buildPartnerOnboardingUpdate(partner, context, offeringData),
        });
      }

      // 4. Update partner stats
      await tx.partner.update({
        where: { id: partner.id },
        data: {
          totalOfferings: { increment: 1 },
          publishedOfferings:
            (status as string) === 'published' ? { increment: 1 } : undefined,
        },
      });

      return newOffering;
    });

    console.log('[Finalize] Offering created successfully:', offering.id);

    // Update conversation context
    const updatedContext: AIOnboardingContext = {
      ...context,
      phase: 'complete',
      createdOfferingId: offering.id,
    };

    await prisma.chatConversation.update({
      where: { id: sessionId },
      data: {
        context: updatedContext as unknown as Prisma.InputJsonValue,
        status: 'completed',
      },
    });

    // Construct redirect URL
    const redirectUrl = `/partners/offerings/review/${offering.id}`;

    return NextResponse.json({
      offeringId: offering.id,
      slug: offering.slug,
      status: offering.status,
      confidenceScore: offering.confidenceScore || 0,
      embeddingGenerated,
      enrichmentAnswersCount: enrichmentQA.length,
      redirectUrl,
      onboardingCompleted: isFirstTimeOnboarding,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Finalize] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create offering',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
