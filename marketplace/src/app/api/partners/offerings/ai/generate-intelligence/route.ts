// ============================================
// API: Generate Intelligence (Stage 2)
// Generates 37-question questionnaire answers using GPT-4o
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { generateIntelligence } from '@/lib/ai-onboarding/intelligence-generator';
import { AIOnboardingContext } from '@/lib/ai-onboarding/types';
import { Prisma } from '@prisma/client';

const generateIntelligenceSchema = z.object({
  sessionId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate partner
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await req.json();
    const { sessionId } = generateIntelligenceSchema.parse(body);

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

    // Run Stage 2: Intelligence generation
    console.log('[Generate Intelligence] Running Stage 2 generation...');

    const result = await generateIntelligence(
      context.offeringName,
      context.offeringSummary,
      context.contextSummary,
      context.websiteUrl,
      context.allowWebBrowsing,
      context.uploadedFiles?.map((f) => ({
        filename: f.filename,
        url: f.url,
      }))
    );

    console.log('[Generate Intelligence] Stage 2 complete:', {
      answersLength: result.answers.length,
      missingCount: result.missingQuestions.length,
    });

    // Calculate estimated completeness
    const totalQuestions = 37;
    const answeredCount = totalQuestions - result.missingQuestions.length;
    const estimatedCompleteness = Math.round(
      (answeredCount / totalQuestions) * 100
    );

    // Calculate basic confidence score (will be refined in finalize)
    const confidenceScore = estimatedCompleteness;

    // Update conversation context
    const updatedContext: AIOnboardingContext = {
      ...context,
      phase: result.missingQuestions.length > 0 ? 'refining' : 'intelligence-generated',
      questionnaireAnswers: result.answers,
      missingQuestions: result.missingQuestions,
      estimatedCompleteness,
      confidenceScore,
      tokensUsed: {
        stage1: context.tokensUsed?.stage1 || 0,
        stage2: 3000, // Approximate (actual tracking would require token count from API)
        refinements: context.tokensUsed?.refinements || 0,
        total: (context.tokensUsed?.total || 0) + 3000,
      },
    };

    await prisma.chatConversation.update({
      where: { id: sessionId },
      data: {
        context: updatedContext as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      answers: result.answers,
      missingQuestions: result.missingQuestions,
      clarificationNeeded: result.clarificationNeeded,
      confidenceScore,
      estimatedCompleteness,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Generate Intelligence] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate intelligence',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
