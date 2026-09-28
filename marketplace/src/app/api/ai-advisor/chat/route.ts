import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import {
  AdvisorContext,
  AdvisorOfferingData,
  ExternalRecommendation,
  ScoredOffering,
  TurnInterpretation,
  TurnIntent,
  UserContext,
  advisorOfferingSelect,
} from '@/lib/ai-advisor/types';
import { analyzeIntent } from '@/lib/ai-advisor/openai';
import { validateAndNormalizeCategory } from '@/lib/ai-advisor/category-validator';
import { scoreOfferings } from '@/lib/ai-advisor/scorer';
import { cosineSimilarity } from '@/lib/ai-advisor/similarity';
import { buildExternalRecommendationsPrompt } from '@/lib/ai-advisor/prompts';
import {
  getNextBatch,
  INTERNAL_THRESHOLD,
  MIN_QUALITY_SCORE,
  mergeUniqueIds,
  NO_MORE_RECOMMENDATIONS_MESSAGE,
  normalizeRecommendationState,
  resetRecommendationState,
} from '@/lib/ai-advisor/recommendation-state';
import {
  extractKnownFacts,
  knownFactsToAnswers,
  mergeKnownFacts,
} from '@/lib/ai-advisor/facts';
import {
  hydrateAdvisorContext,
  withAdvisorState,
} from '@/lib/ai-advisor/context-state';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const chatRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1).max(2000),
});

type StoredMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
};

type ChatRouteResponse = {
  reply: string;
  recommendations?: ScoredOffering[];
  externalRecommendations?: ExternalRecommendation[];
};

type ConversationAssets = {
  existingExternalRecommendations: ExternalRecommendation[];
  recommendedOfferings: Array<{
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    pricingModel: string | null;
    startingPrice: number | null;
    averageRating: number;
    offeringType: string;
  }>;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'ai-advisor', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();
    const { conversationId, message } = chatRequestSchema.parse(body);

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const context = hydrateAdvisorContext(
      (conversation.context || {}) as unknown as AdvisorContext
    );
    const hydratedContext = hydrateAdvisorContext(
      enrichContextWithMessageFacts(context, message)
    );
    const previousMessages = Array.isArray(conversation.messages)
      ? (conversation.messages as StoredMessage[])
      : [];
    const assets = await loadConversationAssets(conversationId, hydratedContext);

    const interpretation = await interpretChatTurn({
      message,
      context: hydratedContext,
      previousMessages,
      assets,
    });
    const interpretedContext = withAdvisorState(hydratedContext, {
      facts: {
        rejectedProducts: interpretation.rejectedProducts,
        constraints: interpretation.constraints,
      },
    });

    const actionResult = await dispatchChatAction({
      conversationId,
      message,
      context: interpretedContext,
      previousMessages,
      assets,
      interpretation,
    });

    const result =
      actionResult ||
      (await handleGeneralFollowUp({
        message,
        context: interpretedContext,
        previousMessages,
        recommendedOfferings: assets.recommendedOfferings,
        existingExternalRecommendations: assets.existingExternalRecommendations,
      }));
    const persistedContext = actionResult
      ? actionResult.recommendations || actionResult.externalRecommendations
        ? null
        : withAdvisorState(hydratedContext, {
            facts: interpretedContext.knownFacts,
            mode:
              interpretation.turnIntent === 'compare_existing_recommendations'
                ? 'comparing'
                : interpretation.turnIntent === 'clarify_intent'
                  ? hydratedContext.mode
                  : 'advising',
            lastAssistantIntent: interpretation.turnIntent,
          })
      : withAdvisorState(hydratedContext, {
          facts: interpretedContext.knownFacts,
          mode: 'advising',
          lastAssistantIntent: 'general_advice_follow_up',
        });

    await persistConversationTurn(
      conversationId,
      previousMessages,
      message,
      result.reply,
      persistedContext
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('AI advisor chat error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to continue the conversation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function loadConversationAssets(
  conversationId: string,
  context: AdvisorContext
): Promise<ConversationAssets> {
  const recommendationState = normalizeRecommendationState(context);
  const [existingExternalRecommendations, recommendedOfferings] =
    await Promise.all([
      recommendationState.externalRecommendationIds.length > 0
        ? prisma.externalRecommendation
            .findMany({
              where: {
                id: {
                  in: recommendationState.externalRecommendationIds,
                },
              },
            })
            .then((recommendations) =>
              recommendationState.externalRecommendationIds
                .map((id) => recommendations.find((item) => item.id === id))
                .filter(
                  (item): item is NonNullable<typeof item> => item !== undefined
                )
            )
        : prisma.externalRecommendation.findMany({
            where: { conversationId },
            orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
          }),
      context.recommendationIds && context.recommendationIds.length > 0
        ? prisma.offering.findMany({
            where: {
              id: {
                in: context.recommendationIds,
              },
            },
            select: {
              id: true,
              title: true,
              slug: true,
              shortDescription: true,
              pricingModel: true,
              startingPrice: true,
              averageRating: true,
              offeringType: true,
            },
          })
        : Promise.resolve([]),
    ]);

  return {
    existingExternalRecommendations:
      existingExternalRecommendations as ExternalRecommendation[],
    recommendedOfferings,
  };
}

async function interpretChatTurn(params: {
  message: string;
  context: AdvisorContext;
  previousMessages: StoredMessage[];
  assets: ConversationAssets;
}): Promise<TurnInterpretation> {
  const { message, context, previousMessages, assets } = params;

  const recentTranscript = previousMessages
    .slice(-8)
    .map((entry) => `${entry.role}: ${trimText(entry.content, 140)}`)
    .join('\n');

  const answersContext = context.answers
    ? Object.entries(context.answers)
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${trimText(value, 50)}`)
        .join('; ')
    : 'None recorded';
  const knownFactsContext = buildKnownFactsSummary(context.knownFacts);
  const shownRecommendations = [
    ...assets.recommendedOfferings.map((item) => item.title),
    ...assets.existingExternalRecommendations.map((item) => item.productName),
  ];

  const prompt = `Interpret the latest user turn in an AI software advisor conversation.

Conversation context:
- Original problem: ${trimText(context.problem || 'Unknown', 180)}
- Current category: ${context.detectedCategory || 'Unknown'}
- Current intent: ${trimText(context.detectedIntent || 'Unknown', 120)}
- Current mode: ${context.mode || 'advising'}
- Answers: ${answersContext}
- Known facts: ${knownFactsContext}
- Stored rejected products: ${context.knownFacts?.rejectedProducts?.join(', ') || 'None'}
- Stored constraints/preferences: ${context.knownFacts?.constraints?.join('; ') || 'None'}
- Solution summary: ${trimText(context.aiSolution?.summary || 'No stored solution yet.', 180)}
- Last assistant intent: ${context.lastAssistantIntent || 'None'}
- Existing internal recommendations: ${
    assets.recommendedOfferings.length > 0
      ? assets.recommendedOfferings.map((item) => item.title).join(', ')
      : 'None'
  }
- Existing external recommendations: ${
    assets.existingExternalRecommendations.length > 0
      ? assets.existingExternalRecommendations
          .map((item) => item.productName)
          .join(', ')
      : 'None'
  }
- Recent conversation:
${recentTranscript || 'None'}

Latest user message:
${trimText(message, 260)}

Use the full conversation context and decide what the user intends now. Choose one turnIntent:
- clarify_intent
- answer_question_from_context
- compare_existing_recommendations
- show_more_recommendations
- recommend_for_current_need
- recommend_for_new_requirement
- general_advice_follow_up

Rules:
- If the user is continuing implementation or advisory discussion, including build-vs-buy, hiring help, rollout, constraints, budget, or feasibility, use general_advice_follow_up and set shouldContinueAdvisoryDiscussion true.
- If the user rejects or rules out shown products, extract those product names into rejectedProducts and extract the reason as constraints. Do not generate recommendations unless they also ask for new alternatives.
- If the user asks to see the same existing recommendations again, set shouldReplayExistingRecommendations true.
- If the user asks for additional or replacement options for the same need, use show_more_recommendations and set shouldGenerateRecommendations true.
- If the user asks for recommendations for the current need before recommendations exist, use recommend_for_current_need and set shouldGenerateRecommendations true.
- Use recommend_for_new_requirement only when the user has shifted to a materially different business need, not merely an implementation path for the same need.
- Use clarify_intent when the user message is too ambiguous to answer safely.
- Otherwise use general_advice_follow_up.
- Return valid JSON only with keys: turnIntent, confidence, reasoning, requirementSummary, targetCategory, needsClarification, isNewRequirement, referencesShownRecommendations, replyStrategy, rejectedProducts, constraints, shouldGenerateRecommendations, shouldReplayExistingRecommendations, shouldContinueAdvisoryDiscussion.
- confidence must be a number from 0 to 1.
- needsClarification must be boolean.
- isNewRequirement must be boolean.
- referencesShownRecommendations must be boolean.
- rejectedProducts must be an array of exact product names from this conversation or the latest user message.
- constraints must be an array of concise user constraints/preferences newly stated or reinforced by the latest message.
- shouldGenerateRecommendations, shouldReplayExistingRecommendations, and shouldContinueAdvisoryDiscussion must be booleans.
- replyStrategy must be one of: clarify, answer, compare, recommend, paginate.
- requirementSummary should be a short problem statement if recommendations should be fetched, else null.
- targetCategory should be a category slug if clearly inferable, else null.
- Shown recommendation names available for reference: ${shownRecommendations.length > 0 ? shownRecommendations.join(', ') : 'None'}.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You classify conversational turns for an SMB software advisor. Output strict JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 420,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty interpretation response');
    }

    const parsed = JSON.parse(content) as Partial<TurnInterpretation>;
    return sanitizeInterpretation(parsed);
  } catch (error) {
    console.error('Chat turn interpretation failed:', error);
    return buildFallbackInterpretation(message);
  }
}

function sanitizeInterpretation(
  parsed: Partial<TurnInterpretation>
): TurnInterpretation {
  const allowedActions: TurnIntent[] = [
    'clarify_intent',
    'answer_question_from_context',
    'compare_existing_recommendations',
    'show_more_recommendations',
    'recommend_for_current_need',
    'recommend_for_new_requirement',
    'general_advice_follow_up',
  ];

  const turnIntent = allowedActions.includes(parsed.turnIntent as TurnIntent)
    ? (parsed.turnIntent as TurnIntent)
    : 'general_advice_follow_up';

  const replyStrategy =
    parsed.replyStrategy === 'clarify' ||
    parsed.replyStrategy === 'answer' ||
    parsed.replyStrategy === 'compare' ||
    parsed.replyStrategy === 'recommend' ||
    parsed.replyStrategy === 'paginate'
      ? parsed.replyStrategy
      : 'answer';

  const sanitized: TurnInterpretation = {
    turnIntent,
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'No reasoning provided.',
    needsClarification: Boolean(parsed.needsClarification),
    isNewRequirement: Boolean(parsed.isNewRequirement),
    referencesShownRecommendations: Boolean(
      parsed.referencesShownRecommendations
    ),
    replyStrategy,
    requirementSummary:
      typeof parsed.requirementSummary === 'string' &&
      parsed.requirementSummary.trim()
        ? parsed.requirementSummary.trim()
        : null,
    targetCategory:
      typeof parsed.targetCategory === 'string' && parsed.targetCategory.trim()
        ? parsed.targetCategory.trim()
        : null,
    rejectedProducts: normalizeStringArray(parsed.rejectedProducts),
    constraints: normalizeStringArray(parsed.constraints),
    shouldGenerateRecommendations: Boolean(parsed.shouldGenerateRecommendations),
    shouldReplayExistingRecommendations: Boolean(
      parsed.shouldReplayExistingRecommendations
    ),
    shouldContinueAdvisoryDiscussion: Boolean(
      parsed.shouldContinueAdvisoryDiscussion
    ),
  };

  if (
    (sanitized.turnIntent === 'recommend_for_current_need' ||
      sanitized.turnIntent === 'recommend_for_new_requirement' ||
      sanitized.turnIntent === 'show_more_recommendations') &&
    !sanitized.requirementSummary
  ) {
    sanitized.shouldGenerateRecommendations = true;
  }

  if (
    sanitized.turnIntent === 'clarify_intent' &&
    !sanitized.needsClarification
  ) {
    sanitized.needsClarification = true;
  }

  return sanitized;
}

function buildFallbackInterpretation(message: string): TurnInterpretation {
  return {
    turnIntent:
      message.trim().split(/\s+/).length <= 3
        ? 'clarify_intent'
        : 'general_advice_follow_up',
    confidence: 0.3,
    reasoning: 'Fallback to general follow-up when interpretation is uncertain.',
    needsClarification: message.trim().split(/\s+/).length <= 3,
    isNewRequirement: false,
    referencesShownRecommendations: false,
    replyStrategy:
      message.trim().split(/\s+/).length <= 3 ? 'clarify' : 'answer',
    requirementSummary: null,
    targetCategory: null,
    rejectedProducts: [],
    constraints: [],
    shouldGenerateRecommendations: false,
    shouldReplayExistingRecommendations: false,
    shouldContinueAdvisoryDiscussion: message.trim().split(/\s+/).length > 3,
  };
}

async function dispatchChatAction(params: {
  conversationId: string;
  message: string;
  context: AdvisorContext;
  previousMessages: StoredMessage[];
  assets: ConversationAssets;
  interpretation: TurnInterpretation;
}): Promise<ChatRouteResponse | null> {
  const {
    conversationId,
    message,
    context,
    assets,
    interpretation,
  } = params;

  if (interpretation.shouldReplayExistingRecommendations) {
    const externalRecommendations = filterExternalRecommendationsForContext(
      getVisibleExternalRecommendations(assets.existingExternalRecommendations, context),
      context,
      { allowRejectedProducts: true }
    );

    if (externalRecommendations.length > 0) {
      return {
        reply: 'Here are the external options we already discussed.',
        externalRecommendations,
      };
    }
  }

  switch (interpretation.turnIntent) {
    case 'clarify_intent':
      return {
        reply: buildClarificationReply(assets),
      };
    case 'answer_question_from_context':
    case 'compare_existing_recommendations':
      return null;
    case 'show_more_recommendations':
      if (!interpretation.shouldGenerateRecommendations) {
        return null;
      }
      return refreshRecommendationsForRequirement(
        conversationId,
        interpretation.requirementSummary || context.currentNeedSummary || message,
        context,
        interpretation.targetCategory,
        false
      );
    case 'recommend_for_current_need':
      if (!interpretation.shouldGenerateRecommendations) {
        return null;
      }
      return refreshRecommendationsForRequirement(
        conversationId,
        interpretation.requirementSummary || message,
        context,
        interpretation.targetCategory,
        false
      );
    case 'recommend_for_new_requirement':
      if (
        !interpretation.isNewRequirement &&
        !interpretation.shouldGenerateRecommendations
      ) {
        return null;
      }
      return refreshRecommendationsForRequirement(
        conversationId,
        interpretation.requirementSummary || message,
        context,
        interpretation.targetCategory,
        true
      );
    case 'general_advice_follow_up':
    default:
      return null;
  }
}

async function handleGeneralFollowUp(params: {
  message: string;
  context: AdvisorContext;
  previousMessages: StoredMessage[];
  recommendedOfferings: ConversationAssets['recommendedOfferings'];
  existingExternalRecommendations: ExternalRecommendation[];
}): Promise<ChatRouteResponse> {
  const {
    message,
    context,
    previousMessages,
    recommendedOfferings,
    existingExternalRecommendations,
  } = params;

  const priorTranscript = previousMessages
    .slice(-4)
    .map((entry) => `${entry.role}: ${trimText(entry.content, 180)}`)
    .join('\n');

  const answersContext = context.answers
    ? Object.entries(context.answers)
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${trimText(value, 60)}`)
        .join('; ')
    : 'None recorded';

  const recommendationContext =
    recommendedOfferings.length > 0
      ? recommendedOfferings.map((offering) => offering.title).join(', ')
      : existingExternalRecommendations.length > 0
        ? existingExternalRecommendations
            .map((offering) => offering.productName)
            .join(', ')
        : 'No recommendations have been shown yet.';
  const knownFactsContext = buildKnownFactsSummary(context.knownFacts);

  const prompt = `You are Compass AI Advisor, a business advisor helping an SMB after an earlier intake flow.

Current context:
- Original problem: ${trimText(context.problem || 'Unknown', 220)}
- Detected intent: ${context.detectedIntent || 'Unknown'}
- Detected category: ${context.detectedCategory || 'Unknown'}
- Answers: ${answersContext}
- Known facts: ${knownFactsContext}
- Rejected products: ${context.knownFacts?.rejectedProducts?.join(', ') || 'None'}
- Constraints/preferences: ${context.knownFacts?.constraints?.join('; ') || 'None'}
- Solution summary: ${trimText(context.aiSolution?.summary || 'No formal solution stored yet.', 220)}
- Recommendations already shown: ${recommendationContext}
- Recent conversation:
${priorTranscript || 'None'}

Latest user message:
${trimText(message, 300)}

Instructions:
- First answer the user's actual intent for this turn.
- Answer with awareness of the full context above.
- Be helpful, practical, and concise.
- If recommendations were already shown, you may discuss them by name.
- Do not fetch or imply new recommendations unless the user is clearly asking for new options.
- If intent is ambiguous, ask one targeted clarification question.
- Do not invent marketplace products.
- Maintain continuity with the earlier advice instead of restarting.
- Ask at most one follow-up question, only if it truly helps.
- Return plain text only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a concise, thoughtful SMB advisor. Ground every answer in the provided conversation context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 220,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      buildFallbackReply(
        context,
        recommendedOfferings.length > 0 ||
          existingExternalRecommendations.length > 0
      );

    return { reply };
  } catch (error) {
    console.error('AI advisor chat completion failed:', error);
    return {
      reply: buildFallbackReply(
        context,
        recommendedOfferings.length > 0 ||
          existingExternalRecommendations.length > 0
      ),
    };
  }
}

function buildFallbackReply(
  context: AdvisorContext,
  hasRecommendations: boolean
) {
  if (hasRecommendations) {
    return 'We can keep refining the options we already discussed by fit, cost, rollout effort, or ease of use. Ask me to compare them or narrow them down.';
  }

  return `Based on the problem and solution we have already discussed, I would keep refining the rollout plan around your immediate priority, the team involved, and the budget constraint before choosing tools. If you want, I can help break the solution into a 30-day action plan or move into tool recommendations next.`;
}

async function refreshRecommendationsForRequirement(
  conversationId: string,
  requirementText: string,
  context: AdvisorContext,
  preferredCategory: string | null,
  isNewRequirement: boolean
): Promise<ChatRouteResponse> {
  const baseContext = isNewRequirement
    ? resetRecommendationState(context)
    : context;
  const recommendationState = normalizeRecommendationState(baseContext);
  const resolvedIntent = await resolveRecommendationIntent(
    requirementText,
    preferredCategory
  );

  const userContext: UserContext = {
    problemDescription: requirementText,
    detectedCategory: resolvedIntent.detectedCategory || 'external',
    detectedIntent: resolvedIntent.detectedIntent,
    teamSize: context.knownFacts?.teamSize || context.answers?.q1 || context.answers?.['team-size'],
    budget: context.knownFacts?.budget || context.answers?.q2 || context.answers?.budget,
    urgency: context.knownFacts?.urgency || context.answers?.q3 || context.answers?.urgency,
    companyStage: context.knownFacts?.companyStage || context.answers?.q4 || context.answers?.['company-stage'],
    useCases: context.knownFacts?.useCases || [],
    integrations: context.knownFacts?.integrations || [],
    rejectedProducts: context.knownFacts?.rejectedProducts || [],
    constraints: context.knownFacts?.constraints || [],
  };

  if (!resolvedIntent.detectedCategory) {
    const externalRecommendations = await generateExternalRecommendationsForMessage(
      conversationId,
      userContext
    );
    const nextExternalBatch = getNextBatch(
      externalRecommendations,
      recommendationState.shownExternalIds,
      (recommendation) => recommendation.id
    );

    await updateRecommendationContext(conversationId, {
      ...withAdvisorState(baseContext, {
        facts: {
        category: resolvedIntent.detectedCategory || undefined,
        useCases: userContext.useCases,
        integrations: userContext.integrations,
        },
        currentNeedSummary: requirementText,
        recommendationSource: 'external',
        lastAssistantIntent: isNewRequirement
          ? 'recommend_for_new_requirement'
          : 'recommend_for_current_need',
      }),
      recommendationIds: [],
      shownRecommendationIds: [],
      shownInternalIds: [],
      externalRecommendationIds: externalRecommendations.map((item) => item.id),
      availableExternalIds: externalRecommendations.map((item) => item.id),
      shownExternalIds: nextExternalBatch.map((item) => item.id),
      lastRecommendationType: 'external',
      recommendationExhausted: false,
    });

    return {
      reply: isNewRequirement
        ? 'This sounds like a different requirement from the earlier conversation, and I do not see a matching category in our marketplace right now. I pulled together external options instead.'
        : 'I do not see a strong marketplace category for this need yet, so I pulled together external options instead.',
      externalRecommendations: nextExternalBatch,
    };
  }

  const offerings = await prisma.offering.findMany({
    where: {
      status: 'published',
      OR: [
        {
          primaryFunction: {
            contains: resolvedIntent.detectedCategory,
            mode: 'insensitive',
          },
        },
        {
          categories: {
            some: {
              slug: {
                contains: resolvedIntent.detectedCategory,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    },
    select: advisorOfferingSelect,
    take: 20,
    orderBy: {
      averageRating: 'desc',
    },
  });

  if (offerings.length === 0) {
    const externalRecommendations = await generateExternalRecommendationsForMessage(
      conversationId,
      userContext
    );
    const nextExternalBatch = getNextBatch(
      externalRecommendations,
      recommendationState.shownExternalIds,
      (recommendation) => recommendation.id
    );

    await updateRecommendationContext(conversationId, {
      ...withAdvisorState(baseContext, {
        facts: {
        category: resolvedIntent.detectedCategory || undefined,
        useCases: userContext.useCases,
        integrations: userContext.integrations,
        },
        currentNeedSummary: requirementText,
        recommendationSource: 'external',
        lastAssistantIntent: isNewRequirement
          ? 'recommend_for_new_requirement'
          : 'recommend_for_current_need',
      }),
      recommendationIds: [],
      shownRecommendationIds: [],
      shownInternalIds: [],
      externalRecommendationIds: externalRecommendations.map((item) => item.id),
      availableExternalIds: externalRecommendations.map((item) => item.id),
      shownExternalIds: nextExternalBatch.map((item) => item.id),
      lastRecommendationType: 'external',
      recommendationExhausted: false,
    });

    return {
      reply: isNewRequirement
        ? `This looks like a shift toward ${resolvedIntent.detectedCategory}, but I could not find matching marketplace offerings yet. I pulled together external options for this new requirement.`
        : `I checked the marketplace for ${resolvedIntent.detectedCategory}, but I could not find matching offerings yet. I pulled together external options instead.`,
      externalRecommendations: nextExternalBatch,
    };
  }

  const advisorOfferings = offerings as AdvisorOfferingData[];
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: requirementText,
  });

  const userEmbedding = embeddingResponse.data[0].embedding;
  const similarityMap = new Map<string, number>();

  advisorOfferings.forEach((offering) => {
    if (
      offering.embedding &&
      Array.isArray(offering.embedding) &&
      offering.embedding.length === userEmbedding.length
    ) {
      try {
        similarityMap.set(
          offering.id,
          cosineSimilarity(userEmbedding, offering.embedding)
        );
      } catch (error) {
        console.error(
          `Failed to calculate similarity for offering ${offering.id}:`,
          error
        );
        similarityMap.set(offering.id, 0);
      }
    } else {
      similarityMap.set(offering.id, 0);
    }
  });

  const scoredOfferings = await scoreOfferings(
    advisorOfferings,
    userContext,
    similarityMap
  );
  const strongInternal = scoredOfferings.filter(
    (offering) => offering.matchScore >= MIN_QUALITY_SCORE
  );
  const shouldUseInternal =
    strongInternal.length > 0 &&
    (strongInternal[0]?.matchScore || 0) >= INTERNAL_THRESHOLD;
  const nextInternalBatch = getNextBatch(
    strongInternal,
    recommendationState.shownInternalIds,
    (offering) => offering.offering.id
  );
  const storedExternalRecommendations =
    recommendationState.externalRecommendationIds.length > 0
      ? await prisma.externalRecommendation.findMany({
          where: {
            id: {
              in: recommendationState.externalRecommendationIds,
            },
          },
        })
      : [];
  const orderedExternalRecommendations = recommendationState.externalRecommendationIds
    .map((id) => storedExternalRecommendations.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const eligibleExternalRecommendations = filterExternalRecommendationsForContext(
    orderedExternalRecommendations as ExternalRecommendation[],
    baseContext
  );
  const nextExternalBatch = getNextBatch(
    eligibleExternalRecommendations,
    recommendationState.shownExternalIds,
    (recommendation) => recommendation.id
  );

  if (shouldUseInternal && nextInternalBatch.length > 0) {
    const recommendations = nextInternalBatch.map((offering) => ({
      ...offering,
      reasoning: buildCompactRecommendationReason(offering),
    }));

    const nextRecommendationIds = recommendations.map((item) => item.offering.id);
    await updateRecommendationContext(conversationId, {
      ...withAdvisorState(baseContext, {
        facts: {
        category: resolvedIntent.detectedCategory || undefined,
        useCases: userContext.useCases,
        integrations: userContext.integrations,
        },
        currentNeedSummary: requirementText,
        recommendationSource: 'internal',
        lastAssistantIntent: isNewRequirement
          ? 'recommend_for_new_requirement'
          : recommendationState.shownInternalIds.length > 0
            ? 'show_more_recommendations'
            : 'recommend_for_current_need',
      }),
      recommendationIds: nextRecommendationIds,
      shownRecommendationIds: mergeUniqueIds(
        recommendationState.shownInternalIds,
        nextRecommendationIds
      ),
      shownInternalIds: mergeUniqueIds(
        recommendationState.shownInternalIds,
        nextRecommendationIds
      ),
      externalRecommendationIds: recommendationState.externalRecommendationIds,
      shownExternalIds: recommendationState.shownExternalIds,
      lastRecommendationType: 'internal',
      recommendationExhausted: false,
    });

    return {
      reply: isNewRequirement
        ? `It looks like you have shifted to a new requirement in ${resolvedIntent.detectedCategory}. I re-ran the marketplace match for that need and found these options.`
        : recommendationState.shownInternalIds.length > 0
          ? 'Here are additional marketplace options for the same need beyond the ones already shown.'
          : 'I matched your current requirement again and found the options that fit best right now.',
      recommendations,
    };
  }

  if (nextExternalBatch.length > 0) {
    await updateRecommendationContext(conversationId, {
      ...withAdvisorState(baseContext, {
        facts: {
          category: resolvedIntent.detectedCategory || undefined,
        },
        currentNeedSummary: requirementText,
        recommendationSource: 'external',
        lastAssistantIntent: 'show_more_recommendations',
      }),
      recommendationIds: [],
      shownRecommendationIds: recommendationState.shownInternalIds,
      shownInternalIds: recommendationState.shownInternalIds,
      externalRecommendationIds: recommendationState.externalRecommendationIds,
      shownExternalIds: mergeUniqueIds(
        recommendationState.shownExternalIds,
        nextExternalBatch.map((item) => item.id)
      ),
      lastRecommendationType: 'external',
      recommendationExhausted: false,
    });

    return {
      reply:
        'I have already shown the strongest marketplace matches for this need, so here are external alternatives to widen the options.',
      externalRecommendations: nextExternalBatch,
    };
  }

  if (recommendationState.externalRecommendationIds.length > 0) {
    await updateRecommendationContext(conversationId, {
      ...withAdvisorState(baseContext, {
        facts: {
          category: resolvedIntent.detectedCategory || undefined,
        },
        currentNeedSummary: requirementText,
        lastAssistantIntent: 'show_more_recommendations',
      }),
      recommendationExhausted: true,
    });

    return {
      reply: NO_MORE_RECOMMENDATIONS_MESSAGE,
    };
  }

  const externalRecommendations = await generateExternalRecommendationsForMessage(
    conversationId,
    userContext
  );
  const firstExternalBatch = getNextBatch(
    externalRecommendations,
    [],
    (recommendation) => recommendation.id
  );

  await updateRecommendationContext(conversationId, {
    ...withAdvisorState(baseContext, {
      facts: {
      category: resolvedIntent.detectedCategory || undefined,
      useCases: userContext.useCases,
      integrations: userContext.integrations,
      },
      currentNeedSummary: requirementText,
      recommendationSource: 'external',
      lastAssistantIntent: isNewRequirement
        ? 'recommend_for_new_requirement'
        : 'show_more_recommendations',
    }),
    recommendationIds: [],
    shownRecommendationIds: recommendationState.shownInternalIds,
    shownInternalIds: recommendationState.shownInternalIds,
    externalRecommendationIds: externalRecommendations.map((item) => item.id),
    availableExternalIds: externalRecommendations.map((item) => item.id),
    shownExternalIds: firstExternalBatch.map((item) => item.id),
    lastRecommendationType: 'external',
    recommendationExhausted: false,
  });

  return {
    reply: shouldUseInternal
      ? 'I have already shown the remaining internal matches, so I pulled together external alternatives next.'
      : isNewRequirement
        ? `I found the new requirement and checked the marketplace, but the internal matches are not strong enough. I pulled together external recommendations for ${resolvedIntent.detectedCategory} instead.`
        : `I checked the marketplace for this need, but the internal matches are not strong enough. I pulled together external recommendations for ${resolvedIntent.detectedCategory} instead.`,
    externalRecommendations: firstExternalBatch,
  };
}

async function resolveRecommendationIntent(
  requirementText: string,
  preferredCategory: string | null
) {
  const intentAnalysis = await analyzeIntent(requirementText).catch(() => null);

  const candidateCategory =
    preferredCategory ||
    intentAnalysis?.detectedCategory ||
    null;

  const detectedCategory = candidateCategory
    ? (await validateAndNormalizeCategory(candidateCategory)).slug || null
    : null;

  return {
    detectedCategory,
    detectedIntent: intentAnalysis?.detectedIntent || requirementText,
  };
}

async function generateExternalRecommendationsForMessage(
  conversationId: string,
  userContext: UserContext
) {
  const prompt = buildExternalRecommendationsPrompt(
    userContext.problemDescription,
    userContext.detectedCategory,
    {
      teamSize: userContext.teamSize,
      budget: userContext.budget,
      urgency: userContext.urgency,
      companyStage: userContext.companyStage,
      rejectedProducts: userContext.rejectedProducts,
      constraints: userContext.constraints,
    }
  );

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert business software advisor. Only suggest well-known, established products. Do not invent tools. If unsure about URL, use null. Always return valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content?.trim() || '[]';
  const parsedRecommendations = JSON.parse(content) as Array<{
    productName: string;
    productUrl: string | null;
    category: string;
    shortDescription: string;
    reasoning: string;
    confidence: number;
  }>;
  const existingOfferings = await prisma.offering.findMany({
    where: { status: 'published' },
    select: { website: true },
  });
  const existingDomains = new Set(
    existingOfferings
      .map((offering) => extractDomain(offering.website))
      .filter((domain): domain is string => domain !== null)
  );
  const existingExternalRecommendations = await prisma.externalRecommendation.findMany({
    where: { conversationId },
    select: { productName: true },
  });
  const previouslyShownProducts = existingExternalRecommendations.map(
    (recommendation) => recommendation.productName
  );
  const filteredRecommendations = filterExternalRecommendationDrafts(
    parsedRecommendations,
    {
      rejectedProducts: userContext.rejectedProducts || [],
      excludedProductNames: previouslyShownProducts,
      existingDomains,
    }
  );

  const storedRecommendations = await Promise.all(
    filteredRecommendations.map((recommendation) =>
      prisma.externalRecommendation.create({
        data: {
          conversationId,
          productName: recommendation.productName,
          productUrl: recommendation.productUrl,
          category: recommendation.category,
          shortDescription: recommendation.shortDescription,
          reasoning: recommendation.reasoning,
          confidence: recommendation.confidence,
          source: 'ai_generated',
          clickCount: 0,
          potentialLead: true,
          verified: false,
        },
      })
    )
  );

  return storedRecommendations as ExternalRecommendation[];
}

async function updateRecommendationContext(
  conversationId: string,
  context: AdvisorContext
) {
  const hydrated = hydrateAdvisorContext(context);
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      context: hydrated as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}

type ExternalRecommendationDraft = {
  productName: string;
  productUrl: string | null;
  category: string;
  shortDescription: string;
  reasoning: string;
  confidence: number;
};

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function filterExternalRecommendationDrafts<T extends ExternalRecommendationDraft>(
  recommendations: T[],
  options: {
    rejectedProducts: string[];
    excludedProductNames?: string[];
    existingDomains?: Set<string>;
  }
) {
  const rejectedNames = new Set(
    options.rejectedProducts.map(normalizeProductName).filter(Boolean)
  );
  const excludedNames = new Set(
    (options.excludedProductNames || [])
      .map(normalizeProductName)
      .filter(Boolean)
  );

  return recommendations.filter((recommendation) => {
    const normalizedName = normalizeProductName(recommendation.productName);
    const domain = extractDomain(recommendation.productUrl);

    if (rejectedNames.has(normalizedName)) return false;
    if (excludedNames.has(normalizedName)) return false;
    if (domain && options.existingDomains?.has(domain)) return false;

    return true;
  });
}

function filterExternalRecommendationsForContext<T extends ExternalRecommendation>(
  recommendations: T[],
  context: AdvisorContext,
  options: { allowRejectedProducts?: boolean } = {}
) {
  if (options.allowRejectedProducts) return recommendations;

  const rejectedNames = new Set(
    (context.knownFacts?.rejectedProducts || [])
      .map(normalizeProductName)
      .filter(Boolean)
  );

  return recommendations.filter(
    (recommendation) =>
      !rejectedNames.has(normalizeProductName(recommendation.productName))
  );
}

function getVisibleExternalRecommendations(
  recommendations: ExternalRecommendation[],
  context: AdvisorContext
) {
  const visibleIds = context.shownExternalIds || [];
  if (visibleIds.length === 0) return recommendations;

  const visibleRecommendations = recommendations.filter((recommendation) =>
    visibleIds.includes(recommendation.id)
  );

  return visibleRecommendations.length > 0 ? visibleRecommendations : recommendations;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        )
      )
    : [];
}

function buildCompactRecommendationReason(scoredOffering: ScoredOffering) {
  const bits = [];

  if (scoredOffering.scoreBreakdown.categoryMatch > 0) {
    bits.push('strong category fit');
  }

  if (scoredOffering.scoreBreakdown.useCaseMatch >= 12) {
    bits.push('good use-case alignment');
  }

  if (scoredOffering.scoreBreakdown.budgetMatch >= 10) {
    bits.push('pricing is aligned');
  }

  if (scoredOffering.scoreBreakdown.teamSizeMatch >= 7) {
    bits.push('team size fit');
  }

  const summary = bits.length > 0 ? bits.join(', ') : 'good overall fit';
  return `${scoredOffering.offering.title} scored ${Math.round(
    scoredOffering.matchScore
  )}/100 for this updated need with ${summary}. ${trimText(
    scoredOffering.offering.shortDescription || '',
    120
  )}`.trim();
}

async function persistConversationTurn(
  conversationId: string,
  previousMessages: StoredMessage[],
  userMessage: string,
  assistantReply: string,
  context?: AdvisorContext | null
) {
  const persistedContext = context ? hydrateAdvisorContext(context) : null;
  const updatedMessages: StoredMessage[] = [
    ...previousMessages,
    {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    },
    {
      role: 'assistant',
      content: assistantReply,
      timestamp: new Date().toISOString(),
    },
  ];

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      ...(context
        ? { context: persistedContext as unknown as Prisma.InputJsonValue }
        : {}),
      messages: updatedMessages as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}

function enrichContextWithMessageFacts(
  context: AdvisorContext,
  message: string
) {
  const extractedFacts = extractKnownFacts(message, context.detectedCategory);
  const mergedKnownFacts = mergeKnownFacts(
    context.facts || context.knownFacts,
    extractedFacts
  );

  return withAdvisorState(context, {
    facts: mergedKnownFacts,
    answers: {
      ...(context.answers || {}),
      ...knownFactsToAnswers(mergedKnownFacts),
    },
  });
}

function buildKnownFactsSummary(knownFacts?: AdvisorContext['knownFacts']) {
  const facts = knownFacts;
  if (!facts) {
    return 'None confirmed yet';
  }

  const parts: string[] = [];

  if (facts.category) parts.push(`category: ${facts.category}`);
  if (facts.teamSize) parts.push(`team size: ${facts.teamSize}`);
  if (facts.budget) parts.push(`budget: ${facts.budget}`);
  if (facts.urgency) parts.push(`urgency: ${facts.urgency}`);
  if (facts.companyStage) {
    parts.push(`company stage: ${facts.companyStage}`);
  }
  if (facts.useCases && facts.useCases.length > 0) {
    parts.push(`use cases: ${facts.useCases.join(', ')}`);
  }
  if (facts.integrations && facts.integrations.length > 0) {
    parts.push(`integrations: ${facts.integrations.join(', ')}`);
  }
  if (facts.rejectedProducts && facts.rejectedProducts.length > 0) {
    parts.push(`rejected products: ${facts.rejectedProducts.join(', ')}`);
  }
  if (facts.constraints && facts.constraints.length > 0) {
    parts.push(`constraints: ${facts.constraints.join('; ')}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'None confirmed yet';
}

function buildClarificationReply(assets: ConversationAssets) {
  if (
    assets.recommendedOfferings.length === 0 &&
    assets.existingExternalRecommendations.length === 0
  ) {
    return `I can help, but I want to make sure I answer the right thing. Do you want advice on the current business problem, or do you want me to recommend tools for it?`;
  }

  return `I can help with that, but I need one quick clarification. Do you want me to compare the options already shown, or find additional alternatives?`;
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}
