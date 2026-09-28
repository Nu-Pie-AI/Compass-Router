import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { AdvisorContext, AdvisorQuestion } from '@/lib/ai-advisor/types';
import { calculateClarityScore } from '@/lib/ai-advisor/clarity-scorer';
import { buildIterativeQuestionPrompt } from '@/lib/ai-advisor/prompts';
import {
  localizeBudgetQuestion,
  resolveCurrencyContext,
} from '@/lib/ai-advisor/locale';
import {
  extractKnownFacts,
  identifyQuestionSlot,
  isQuestionAnswered,
  mergeKnownFacts,
  knownFactsToAnswers,
  updateKnownFactsFromAnswer,
} from '@/lib/ai-advisor/facts';
import { getNextFrameworkQuestion } from '@/lib/ai-advisor/clarification-framework';
import { hydrateAdvisorContext } from '@/lib/ai-advisor/context-state';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const clarifyRequestSchema = z.object({
  conversationId: z.string(),
  latestAnswer: z.object({
    questionId: z.string(),
    answer: z.string(),
  }),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum questions before forcing solution generation
const MAX_QUESTIONS = 10;

// Minimum questions before allowing skip
const MIN_QUESTIONS = 2;

// Clarity threshold for automatic continuation
const CLARITY_THRESHOLD = 60;

/**
 * POST /api/ai-advisor/clarify
 *
 * Iterative clarification endpoint
 *
 * Request body:
 * {
 *   "conversationId": "clxxx",
 *   "latestAnswer": {
 *     "questionId": "q2",
 *     "answer": "$50-200"
 *   }
 * }
 *
 * Response:
 * {
 *   "clarityScore": 45,
 *   "clarityBreakdown": { ... },
 *   "shouldContinue": true,
 *   "nextQuestions": [{ id, text, options }],
 *   "questionsAsked": 2,
 *   "maxQuestions": 10
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'ai-advisor', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();
    const { conversationId, latestAnswer } = clarifyRequestSchema.parse(body);
    const currencyContext = resolveCurrencyContext(
      req.headers.get('accept-language'),
      req.headers.get('x-user-locale'),
      req.headers.get('x-user-timezone')
    );

    // Step 1: Fetch conversation
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const context = conversation.context as unknown as AdvisorContext;
    if (!context) {
      return NextResponse.json(
        { error: 'Invalid conversation context' },
        { status: 400 }
      );
    }

    const baselineKnownFacts = mergeKnownFacts(
      context.knownFacts,
      extractKnownFacts(context.problem, context.detectedCategory)
    );
    const currentQuestion = context.questions.find(
      (question) => question.id === latestAnswer.questionId
    );
    const mergedKnownFacts = updateKnownFactsFromAnswer({
      existingFacts: baselineKnownFacts,
      questionId: latestAnswer.questionId,
      answer: latestAnswer.answer,
      question: currentQuestion,
      detectedCategory: context.detectedCategory,
    });

    // Step 2: Merge latest answer into context
    const updatedAnswers = {
      ...knownFactsToAnswers(mergedKnownFacts),
      ...(context.answers || {}),
      [latestAnswer.questionId]: latestAnswer.answer,
    };

    const questionsAsked = context.questionsAsked + 1;

    // Step 3: Calculate clarity score
    const clarityScore = calculateClarityScore(
      context.problem,
      context.categoryConfidence || 50, // default if not set
      updatedAnswers,
      questionsAsked
    );

    console.log('Clarity score calculated:', {
      overall: clarityScore.overall,
      breakdown: clarityScore.breakdown,
      criticalGaps: clarityScore.criticalGaps,
    });

    // Step 4: Determine if should continue clarifying
    let shouldContinue = true;
    let nextQuestions: AdvisorQuestion[] = [];

    // Force stop conditions
    if (questionsAsked >= MAX_QUESTIONS) {
      console.log('Max questions reached, stopping clarification');
      shouldContinue = false;
    } else if (
      clarityScore.overall >= CLARITY_THRESHOLD &&
      questionsAsked >= MIN_QUESTIONS
    ) {
      console.log('Clarity threshold reached, stopping clarification');
      shouldContinue = false;
    } else {
      const frameworkQuestion = getNextFrameworkQuestion({
        category: context.detectedCategory,
        knownFacts: mergedKnownFacts,
        answers: updatedAnswers,
        existingQuestions: context.questions,
        currencyContext,
      });

      if (frameworkQuestion) {
        nextQuestions = [frameworkQuestion];
      } else {
      // Generate next question
        try {
          const prompt = buildIterativeQuestionPrompt(
            context.problem,
            context.detectedCategory,
            updatedAnswers,
            clarityScore.criticalGaps,
            currencyContext
          );

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a business software advisor generating clarifying questions. Always return valid JSON.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 300,
          });

          const responseText = completion.choices[0]?.message?.content?.trim();
          if (!responseText) {
            throw new Error('Empty response from OpenAI');
          }

          // Parse JSON response
          const parsedQuestion = JSON.parse(responseText) as AdvisorQuestion;

          // Validate question structure
          if (!parsedQuestion.id || !parsedQuestion.text || !Array.isArray(parsedQuestion.options)) {
            throw new Error('Invalid question structure');
          }

          // Override question ID with sequential number to prevent duplicates
          parsedQuestion.id = `q${questionsAsked + 1}`;
          const localizedQuestion = localizeBudgetQuestion(
            parsedQuestion,
            currencyContext
          );

          if (
            isQuestionAnswered(localizedQuestion, mergedKnownFacts) ||
            hasAskedEquivalentQuestion(localizedQuestion, context.questions)
          ) {
            const fallbackQuestion = generateFallbackQuestion(
              clarityScore.criticalGaps,
              questionsAsked,
              currencyContext,
              context.questions,
              mergedKnownFacts,
              updatedAnswers
            );

            if (fallbackQuestion) {
              nextQuestions = [fallbackQuestion];
            } else {
              shouldContinue = false;
              nextQuestions = [];
            }
          } else {
            nextQuestions = [localizedQuestion];
          }
        } catch (error) {
          console.error('Failed to generate next question:', error);

          // Fallback: Generate generic question based on critical gaps
          const fallbackQuestion = generateFallbackQuestion(
            clarityScore.criticalGaps,
            questionsAsked,
            currencyContext,
            context.questions,
            mergedKnownFacts,
            updatedAnswers
          );
          if (fallbackQuestion) {
            nextQuestions = [fallbackQuestion];
          } else {
            shouldContinue = false;
            nextQuestions = [];
          }
        }
      }
    }

    // Step 5: Update conversation context
    const updatedContext: AdvisorContext = {
      ...context,
      phase: shouldContinue ? 'clarifying-iterative' : 'solution-generated',
      mode: shouldContinue ? 'clarifying' : 'solution',
      answers: updatedAnswers,
      facts: mergedKnownFacts,
      knownFacts: mergedKnownFacts,
      clarityScore,
      questionsAsked,
      questions: [...context.questions, ...nextQuestions],
      currentNeedSummary: context.currentNeedSummary || context.detectedIntent,
    };

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        context: hydrateAdvisorContext(updatedContext) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Step 6: Return response
    return NextResponse.json({
      clarityScore: clarityScore.overall,
      clarityBreakdown: clarityScore.breakdown,
      shouldContinue,
      nextQuestions,
      questionsAsked,
      maxQuestions: MAX_QUESTIONS,
      criticalGaps: clarityScore.criticalGaps,
    });
  } catch (error) {
    console.error('Clarify endpoint error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to process clarification',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate fallback question when OpenAI fails
 */
function generateFallbackQuestion(
  criticalGaps: string[],
  questionsAsked: number,
  currencyContext: ReturnType<typeof resolveCurrencyContext>,
  existingQuestions: AdvisorQuestion[],
  knownFacts: AdvisorContext['knownFacts'],
  answers: Record<string, string>
): AdvisorQuestion | null {
  const fallbackCandidates: AdvisorQuestion[] = [];

  // Determine what to ask based on critical gaps
  if (criticalGaps.some((gap) => gap.includes('budget'))) {
    fallbackCandidates.push({
      id: `q${questionsAsked + 1}`,
      text: "What's your approximate monthly budget for this solution?",
      options: currencyContext.monthlyBudgetOptions,
      allowMultiple: false,
    });
  }

  if (criticalGaps.some((gap) => gap.includes('team'))) {
    fallbackCandidates.push({
      id: `q${questionsAsked + 1}`,
      text: 'How many team members will be using this solution?',
      options: ['1-5 people', '6-20 people', '21-50 people', '50+ people'],
      allowMultiple: false,
    });
  }

  if (criticalGaps.some((gap) => gap.includes('urgency') || gap.includes('timeline'))) {
    fallbackCandidates.push({
      id: `q${questionsAsked + 1}`,
      text: 'How urgently do you need this solution implemented?',
      options: [
        'Immediate (within 1 month)',
        'Soon (1-3 months)',
        'Planning (3-6 months)',
        'Exploring (6+ months)',
      ],
      allowMultiple: false,
    });
  }

  if (criticalGaps.some((gap) => gap.includes('company') || gap.includes('stage'))) {
    fallbackCandidates.push({
      id: `q${questionsAsked + 1}`,
      text: "What's your company's current stage?",
      options: [
        'Early startup (Seed)',
        'Growing (Series A/B)',
        'Established (Series C+)',
        'Enterprise',
      ],
      allowMultiple: false,
    });
  }

  fallbackCandidates.push({
    id: `q${questionsAsked + 1}`,
    text: 'What is your primary goal with this solution?',
    options: [
      'Save time and automate tasks',
      'Improve team collaboration',
      'Increase revenue/sales',
      'Better data and insights',
    ],
    allowMultiple: true,
  });

  const dedupedCandidate = fallbackCandidates.find(
    (question) =>
      !isQuestionAnswered(question, knownFacts || {}) &&
      !hasAskedEquivalentQuestion(question, existingQuestions) &&
      !isAnswerAlreadyPresent(question, answers)
  );

  return dedupedCandidate || null;
}

function hasAskedEquivalentQuestion(
  question: AdvisorQuestion,
  existingQuestions: AdvisorQuestion[]
) {
  const slot = identifyQuestionSlot(question);
  if (!slot) {
    return existingQuestions.some(
      (existing) => existing.text.toLowerCase().trim() === question.text.toLowerCase().trim()
    );
  }

  return existingQuestions.some(
    (existing) => identifyQuestionSlot(existing) === slot
  );
}

function isAnswerAlreadyPresent(
  question: AdvisorQuestion,
  answers: Record<string, string>
) {
  const slot = identifyQuestionSlot(question);

  if (!slot) {
    return false;
  }

  switch (slot) {
    case 'teamSize':
      return Boolean(answers['team-size'] || answers.q1);
    case 'budget':
      return Boolean(answers.budget || answers.q2);
    case 'urgency':
      return Boolean(answers.urgency || answers.q3);
    case 'companyStage':
      return Boolean(answers['company-stage'] || answers.q4);
    case 'useCases':
      return Boolean(answers['use-cases']);
    case 'integrations':
      return Boolean(answers.integrations);
    default:
      return false;
  }
}
