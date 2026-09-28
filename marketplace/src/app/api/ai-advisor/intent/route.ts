import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { analyzeIntent, generateQuestions } from '@/lib/ai-advisor/openai';
import { AdvisorContext, IntentResult } from '@/lib/ai-advisor/types';
import { validateAndNormalizeCategory } from '@/lib/ai-advisor/category-validator';
import { detectCategoryFromKeywords } from '@/lib/ai-advisor/category-mapper';
import { extractKnownFacts, knownFactsToAnswers } from '@/lib/ai-advisor/facts';
import { resolveCurrencyContext } from '@/lib/ai-advisor/locale';
import { getNextFrameworkQuestion } from '@/lib/ai-advisor/clarification-framework';
import { hydrateAdvisorContext } from '@/lib/ai-advisor/context-state';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const intentRequestSchema = z.object({
  problem: z.string().min(10).max(1000),
  conversationId: z.string().optional(), // For continuing existing conversation
});

/**
 * POST /api/ai-advisor/intent
 *
 * Analyzes user's problem description and generates clarifying questions
 *
 * Request body:
 * {
 *   "problem": "We need a CRM to track our sales leads",
 *   "conversationId": "optional-existing-id"
 * }
 *
 * Response:
 * {
 *   "conversationId": "clxxx",
 *   "detectedCategory": "crm",
 *   "detectedIntent": "Lead tracking and sales management",
 *   "questions": [
 *     {
 *       "id": "q1",
 *       "text": "What is your team size?",
 *       "options": ["1-5 people", "6-20 people", ...]
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'ai-advisor', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();
    const { problem, conversationId } = intentRequestSchema.parse(body);
    const acceptLanguage = req.headers.get('accept-language');
    const currencyContext = resolveCurrencyContext(
      acceptLanguage,
      req.headers.get('x-user-locale'),
      req.headers.get('x-user-timezone')
    );

    // Step 1: Analyze intent with OpenAI
    const { detectedCategory: rawCategory, detectedIntent, confidence } =
      await analyzeIntent(problem);

    // Step 2: Validate and normalize category against database
    const categoryValidation = await validateAndNormalizeCategory(rawCategory);

    let detectedCategory = categoryValidation.slug;

    // Step 2b: If validation failed, try keyword-based detection as fallback
    if (!detectedCategory) {
      console.log('[Intent] Category validation failed, trying keyword detection...');
      const keywordCategory = detectCategoryFromKeywords(problem);

      if (keywordCategory) {
        console.log(`[Intent] Keyword detection found: "${keywordCategory}"`);

        // Validate the keyword-detected category
        const keywordValidation = await validateAndNormalizeCategory(keywordCategory);
        if (keywordValidation.slug) {
          detectedCategory = keywordValidation.slug;
          console.log(`[Intent] Using keyword-detected category: "${detectedCategory}"`);
        }
      }
    }

    console.log('Intent analysis:', {
      rawCategory,
      validatedCategory: detectedCategory,
      confidence: detectedCategory ? categoryValidation.confidence : 'none',
      intent: detectedIntent,
      aiConfidence: confidence,
      offeringsCount: categoryValidation.offeringsCount,
      suggestions: categoryValidation.suggestions,
    });

    // If still no category, return error to trigger external recommendations
    if (!detectedCategory) {
      console.log('[Intent] No valid category found. Will trigger external recommendations.');
      const knownFacts = extractKnownFacts(problem);
      const extractedAnswers = knownFactsToAnswers(knownFacts);

      // Create conversation anyway but mark for external recommendations
      const context: AdvisorContext = {
        phase: 'clarifying',
        mode: 'clarifying',
        problem,
        detectedCategory: 'external', // Special flag
        detectedIntent,
        categoryConfidence: confidence || 0,
        questions: [], // No questions needed for external
        answers: extractedAnswers,
        facts: knownFacts,
        knownFacts,
        questionsAsked: 0,
        currentNeedSummary: detectedIntent,
        recommendationSource: null,
        recommendationIds: [],
        shownRecommendationIds: [],
        shownInternalIds: [],
        externalRecommendationIds: [],
        availableExternalIds: [],
        shownExternalIds: [],
        recommendationExhausted: false,
        lastAssistantIntent: null,
      };

      const conversation = await prisma.chatConversation.create({
        data: {
          context: hydrateAdvisorContext(context) as unknown as Prisma.InputJsonValue,
          messages: [] as Prisma.InputJsonValue,
          status: 'active',
        },
      });

      return NextResponse.json(
        {
          conversationId: conversation.id,
          detectedCategory: null,
          detectedIntent,
          externalRecommendationsRequired: true,
          suggestions: categoryValidation.suggestions,
          message: `I understand you need help with ${detectedIntent}. Unfortunately, we don't have offerings in this category yet. Let me find some external recommendations for you.`,
        },
        { status: 200 }
      );
    }

    // Step 3: Fetch enrichment data from offerings in this category
    const knownFacts = extractKnownFacts(problem, detectedCategory);
    const extractedAnswers = knownFactsToAnswers(knownFacts);

    // Step 3: Fetch enrichment data from offerings in this category
    // Get top offerings to understand common questions/needs
    const topOfferings = await prisma.offering.findMany({
      where: {
        status: 'published',
        categories: {
          some: {
            slug: detectedCategory, // Exact match - already validated
          },
        },
      },
      select: {
        title: true,
        averageRating: true,
        useCases: true,
        painPointsSolved: true,
        enrichmentAnswers: {
          select: {
            question: true,
            answer: true,
          },
          take: 5, // Limit enrichment answers per offering
        },
      },
      take: 10, // Top 10 offerings
      orderBy: {
        averageRating: 'desc',
      },
    });

    // Extract questions and use cases as context
    const allQualifyingQuestions: string[] = [];
    const allUseCases: string[] = [];

    topOfferings.forEach((offering) => {
      // Add use cases
      if (offering.useCases && offering.useCases.length > 0) {
        allUseCases.push(...offering.useCases);
      }

      // Add enrichment questions
      offering.enrichmentAnswers.forEach((ea) => {
        if (ea.question && ea.question.includes('?')) {
          allQualifyingQuestions.push(ea.question);
        }
      });
    });

    console.log(
      'Found qualifying questions from providers:',
      allQualifyingQuestions.length
    );

    // Step 3: Generate ONLY the first clarifying question for iterative flow
    const firstFrameworkQuestion = getNextFrameworkQuestion({
      category: detectedCategory,
      knownFacts,
      answers: extractedAnswers,
      existingQuestions: [],
      currencyContext,
    });

    const questions = firstFrameworkQuestion
      ? [firstFrameworkQuestion]
      : await generateQuestions(
          problem,
          detectedCategory,
          allQualifyingQuestions,
          acceptLanguage,
          knownFacts
        );

    // Step 4: Create or update conversation in database
    const context: AdvisorContext = {
      phase: 'clarifying-iterative', // Use new iterative phase
      mode: 'clarifying',
      problem,
      detectedCategory,
      detectedIntent,
      categoryConfidence: confidence || 50, // Store AI confidence
      questions: questions.length > 0 ? [questions[0]] : [],
      answers: extractedAnswers,
      facts: knownFacts,
      knownFacts,
      questionsAsked: 0, // Initialize counter
      currentNeedSummary: detectedIntent,
      recommendationSource: null,
      recommendationIds: [],
      shownRecommendationIds: [],
      shownInternalIds: [],
      externalRecommendationIds: [],
      availableExternalIds: [],
      shownExternalIds: [],
      recommendationExhausted: false,
      lastAssistantIntent: null,
    };

    const messages = [
      {
        role: 'user',
        content: problem,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: `I understand you need help with ${detectedIntent}. Let me ask a few questions to find the best solution for you.`,
        timestamp: new Date().toISOString(),
      },
    ];

    let conversation;
    if (conversationId) {
      // Update existing conversation
      conversation = await prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          context: hydrateAdvisorContext(context) as unknown as Prisma.InputJsonValue,
          messages: messages as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new conversation
      const sessionId = req.headers.get('x-session-id') || undefined;

      conversation = await prisma.chatConversation.create({
        data: {
          context: hydrateAdvisorContext(context) as unknown as Prisma.InputJsonValue,
          messages: messages as Prisma.InputJsonValue,
          sessionId,
          status: 'active',
        },
      });
    }

    // Step 5: Return result
    const result: IntentResult = {
      conversationId: conversation.id,
      detectedCategory,
      detectedIntent,
      questions,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Intent analysis error:', error);

    return NextResponse.json(
      {
        error: 'Failed to analyze intent',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
