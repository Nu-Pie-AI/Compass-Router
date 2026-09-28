// ============================================
// API: Refine Answers (Clarification Loop)
// Updates only missing questions using incremental approach (73% token savings)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { refineAnswers } from '@/lib/ai-onboarding/intelligence-generator';
import { AIOnboardingContext, ClarificationRound } from '@/lib/ai-onboarding/types';

const MAX_TOTAL_CLARIFICATION_QUESTIONS = 8;

const refineSchema = z.object({
  sessionId: z.string(),
  clarifications: z.record(z.string(), z.string()), // questionId → answer
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
    const { sessionId, clarifications } = refineSchema.parse(body);

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

    if (!context.questionnaireAnswers) {
      return NextResponse.json(
        { error: 'No questionnaire answers found. Run generate-intelligence first.' },
        { status: 400 }
      );
    }

    // Run refinement (incremental update)
    console.log('[Refine] Updating answers for:', Object.keys(clarifications));

    const result = await refineAnswers(
      context.questionnaireAnswers,
      clarifications,
      context.missingQuestions || []
    );

    console.log('[Refine] Refinement complete:', {
      stillMissing: result.stillMissing.length,
    });

    // Track clarification round
    const roundNumber = (context.clarificationRounds?.length || 0) + 1;
    const newRound: ClarificationRound = {
      round: roundNumber,
      questionsAsked: Object.keys(clarifications),
      answersProvided: clarifications,
      timestamp: new Date().toISOString(),
      tokensUsed: 800, // Approximate for incremental update
    };

    // Calculate updated completeness
    const totalQuestions = 37;
    const answeredCount = totalQuestions - result.stillMissing.length;
    const estimatedCompleteness = Math.round(
      (answeredCount / totalQuestions) * 100
    );

    const totalClarificationsAsked =
      (context.clarificationRounds || []).reduce(
        (total, round) => total + round.questionsAsked.length,
        0
      ) + newRound.questionsAsked.length;

    const remainingClarificationBudget = Math.max(
      0,
      MAX_TOTAL_CLARIFICATION_QUESTIONS - totalClarificationsAsked
    );

    const limitedStillMissing =
      remainingClarificationBudget > 0
        ? result.stillMissing.slice(0, remainingClarificationBudget)
        : [];
    const limitedClarificationNeeded =
      remainingClarificationBudget > 0
        ? result.clarificationNeeded.slice(0, remainingClarificationBudget)
        : [];

    // Determine if ready to finalize
    const readyToFinalize =
      result.stillMissing.length === 0 ||
      totalClarificationsAsked >= MAX_TOTAL_CLARIFICATION_QUESTIONS ||
      (roundNumber >= 1 && estimatedCompleteness >= 70) ||
      roundNumber >= 3 ||
      (roundNumber >= 2 && estimatedCompleteness >= 75) ||
      limitedStillMissing.length === 0;

    // Update conversation context
    const updatedContext: AIOnboardingContext = {
      ...context,
      phase: readyToFinalize ? 'intelligence-generated' : 'refining',
      questionnaireAnswers: result.updatedAnswers,
      missingQuestions: readyToFinalize ? [] : limitedStillMissing,
      clarificationRounds: [...(context.clarificationRounds || []), newRound],
      estimatedCompleteness,
      confidenceScore: estimatedCompleteness,
      tokensUsed: {
        stage1: context.tokensUsed?.stage1 || 0,
        stage2: context.tokensUsed?.stage2 || 0,
        refinements: (context.tokensUsed?.refinements || 0) + 800,
        total: (context.tokensUsed?.total || 0) + 800,
      },
    };

    await prisma.chatConversation.update({
      where: { id: sessionId },
      data: {
        context: updatedContext as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      updatedAnswers: result.updatedAnswers,
      stillMissing: readyToFinalize ? [] : limitedStillMissing,
      clarificationNeeded: readyToFinalize ? [] : limitedClarificationNeeded,
      readyToFinalize,
      confidenceScore: estimatedCompleteness,
      clarificationRound: roundNumber,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Refine] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refine answers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
