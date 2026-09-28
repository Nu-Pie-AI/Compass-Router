import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  generateRecommendationReasons,
} from '@/lib/ai-advisor/openai';
import { scoreOfferings } from '@/lib/ai-advisor/scorer';
import {
  AdvisorContext,
  AdvisorOfferingData,
  UserContext,
  ScoredOffering,
  advisorOfferingSelect,
} from '@/lib/ai-advisor/types';
import { buildExternalRecommendationsPrompt, buildReasoningWithSolutionPrompt } from '@/lib/ai-advisor/prompts';
import { cosineSimilarity } from '@/lib/ai-advisor/similarity';
import {
  getNextBatch,
  INTERNAL_THRESHOLD,
  MIN_QUALITY_SCORE,
  mergeUniqueIds,
  normalizeRecommendationState,
  resetRecommendationState,
} from '@/lib/ai-advisor/recommendation-state';
import OpenAI from 'openai';
import { mergeKnownFacts } from '@/lib/ai-advisor/facts';
import { hydrateAdvisorContext } from '@/lib/ai-advisor/context-state';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const recommendRequestSchema = z.object({
  conversationId: z.string(),
  answers: z.record(z.string()), // questionId -> answer text
});


/**
 * POST /api/ai-advisor/recommend
 *
 * Generates offering recommendations based on user's answers
 *
 * Request body:
 * {
 *   "conversationId": "clxxx",
 *   "answers": {
 *     "q1": "6-20 people",
 *     "q2": "$50-200",
 *     "q3": "Series A/Growth"
 *   }
 * }
 *
 * Response:
 * {
 *   "recommendations": [
 *     {
 *       "offering": { id, title, logo, ... },
 *       "matchScore": 87,
 *       "scoreBreakdown": { categoryMatch: 30, ... },
 *       "reasoning": "HubSpot CRM is a strong match because..."
 *     }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'ai-advisor', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();
    const { conversationId, answers } = recommendRequestSchema.parse(body);

    // Step 1: Fetch conversation and validate
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

    const mergedAnswers = {
      ...(context.answers || {}),
      ...answers,
    };
    const mergedKnownFacts = mergeKnownFacts(context.knownFacts, {
      category: context.detectedCategory,
      teamSize: mergedAnswers['q1'] || mergedAnswers['team-size'],
      budget: mergedAnswers['q2'] || mergedAnswers['budget'],
      urgency: mergedAnswers['q3'] || mergedAnswers['urgency'],
      companyStage: mergedAnswers['q4'] || mergedAnswers['company-stage'],
      useCases: mergedAnswers['use-cases']
        ? mergedAnswers['use-cases'].split(',').map((item) => item.trim())
        : undefined,
      integrations: mergedAnswers.integrations
        ? mergedAnswers.integrations.split(',').map((item) => item.trim())
        : undefined,
      rejectedProducts: context.knownFacts?.rejectedProducts,
      constraints: context.knownFacts?.constraints,
    });
    const recommendationState = normalizeRecommendationState(context);

    // Accept multiple valid phases (old and new flow)
    const validPhases = ['clarifying', 'clarifying-iterative', 'solution-generated'];
    if (!validPhases.includes(context.phase)) {
      return NextResponse.json(
        { error: `Invalid conversation state: ${context.phase}. Expected one of: ${validPhases.join(', ')}` },
        { status: 400 }
      );
    }

    // Step 2: Build user context from answers
    const userContext: UserContext = {
      problemDescription: context.problem,
      detectedCategory: context.detectedCategory,
      detectedIntent: context.detectedIntent,
      teamSize: mergedKnownFacts.teamSize,
      budget: mergedKnownFacts.budget,
      urgency: mergedKnownFacts.urgency,
      companyStage: mergedKnownFacts.companyStage,
      useCases: mergedKnownFacts.useCases,
      integrations: mergedKnownFacts.integrations,
      rejectedProducts: mergedKnownFacts.rejectedProducts,
      constraints: mergedKnownFacts.constraints,
    };

    console.log('User context:', userContext);

    // Step 3: Query offerings from database
    // Filter by category and published status
    const offerings = await prisma.offering.findMany({
      where: {
        status: 'published',
        OR: [
          {
            primaryFunction: {
              contains: context.detectedCategory,
              mode: 'insensitive',
            },
          },
          {
            categories: {
              some: {
                slug: {
                  contains: context.detectedCategory,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },
      select: advisorOfferingSelect,
      take: 20, // Limit to top 20 for performance
      orderBy: {
        averageRating: 'desc',
      },
    });

    console.log(`Found ${offerings.length} offerings in category`);

    // If no offerings found, generate external recommendations
    if (offerings.length === 0) {
      console.log('No internal offerings found, generating external recommendations...');

      try {
        const externalRecs = await generateExternalRecommendations(
          userContext,
          conversationId
        );
        const externalBatch = externalRecs.slice(0, 3);

        // Update conversation with external recommendations
        const updatedContext: AdvisorContext = {
          ...resetRecommendationState(context),
          phase: 'complete',
          mode: 'recommending_external',
          answers: mergedAnswers,
          facts: mergedKnownFacts,
          knownFacts: mergedKnownFacts,
          currentNeedSummary: context.currentNeedSummary || context.detectedIntent,
          recommendationSource: 'external',
          externalRecommendationIds: externalRecs.map((rec) => rec.id),
          availableExternalIds: externalRecs.map((rec) => rec.id),
          shownExternalIds: externalBatch.map((rec) => rec.id),
          lastRecommendationType: 'external',
          lastAssistantIntent: 'recommend_for_current_need',
        };

        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: {
            context: hydrateAdvisorContext(updatedContext) as unknown as Prisma.InputJsonValue,
            status: 'closed',
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            type: 'external',
            externalRecommendations: externalBatch,
            message: 'No offerings in our marketplace match your needs yet. Here are some external suggestions:',
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('Failed to generate external recommendations:', error);
        return NextResponse.json(
          {
            error: 'No offerings found',
            message: `No offerings found for category: ${context.detectedCategory}`,
          },
          { status: 404 }
        );
      }
    }

    // Offerings are already in the correct format from the select
    const advisorOfferings: AdvisorOfferingData[] = offerings as AdvisorOfferingData[];

    // Step 4: Calculate embedding-based similarity (deterministic)
    console.log('Calculating embedding-based similarity...');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generate embedding for user's problem
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userContext.problemDescription,
    });

    const userEmbedding = embeddingResponse.data[0].embedding;

    // Calculate cosine similarity with each offering
    const similarityMap = new Map<string, number>();

    advisorOfferings.forEach((offering) => {
      if (
        offering.embedding &&
        Array.isArray(offering.embedding) &&
        offering.embedding.length === userEmbedding.length
      ) {
        try {
          const similarity = cosineSimilarity(
            userEmbedding,
            offering.embedding
          );
          similarityMap.set(offering.id, similarity);
          console.log(`Similarity for ${offering.title}: ${similarity.toFixed(3)}`);
        } catch (error) {
          console.error(`Error calculating similarity for ${offering.title}:`, error);
          similarityMap.set(offering.id, 0);
        }
      } else {
        // No embedding available for this offering
        console.warn(`No embedding for offering: ${offering.title}`);
        similarityMap.set(offering.id, 0);
      }
    });

    // Step 5: Score all offerings with enhanced algorithm
    console.log('Scoring offerings...');
    const scoredOfferings = await scoreOfferings(
      advisorOfferings,
      userContext,
      similarityMap
    );

    // Step 6: Take top 3 recommendations
    const strongInternal = scoredOfferings.filter(
      (offering) => offering.matchScore >= MIN_QUALITY_SCORE
    );
    const topInternalScore = strongInternal[0]?.matchScore || 0;
    const shouldUseInternal =
      strongInternal.length > 0 && topInternalScore >= INTERNAL_THRESHOLD;
    const top3 = strongInternal.slice(0, 3);

    console.log(
      'Top 3 offerings:',
      top3.map((o) => ({ title: o.offering.title, score: o.matchScore }))
    );

    // Smart fallback trigger: Check if best match is too weak
    if (!shouldUseInternal) {
      console.log(
        `Weak match detected (best score: ${top3[0]?.matchScore || 0}). Generating external recommendations...`
      );

      try {
        const externalRecs = await generateExternalRecommendations(
          userContext,
          conversationId
        );
        const externalBatch = getNextBatch(
          externalRecs,
          recommendationState.shownExternalIds,
          (recommendation) => recommendation.id
        );

        // Update conversation with external recommendations
        const updatedContext: AdvisorContext = {
          ...resetRecommendationState(context),
          phase: 'complete',
          mode: 'recommending_external',
          answers: mergedAnswers,
          facts: mergedKnownFacts,
          knownFacts: mergedKnownFacts,
          currentNeedSummary: context.currentNeedSummary || context.detectedIntent,
          recommendationSource: 'external',
          externalRecommendationIds: externalRecs.map((rec) => rec.id),
          availableExternalIds: externalRecs.map((rec) => rec.id),
          shownExternalIds: externalBatch.map((rec) => rec.id),
          lastRecommendationType: 'external',
          lastAssistantIntent: 'recommend_for_current_need',
        };

        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: {
            context: hydrateAdvisorContext(updatedContext) as unknown as Prisma.InputJsonValue,
            status: 'closed',
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            type: 'external',
            externalRecommendations: externalBatch,
            message: 'No strong matches in our marketplace. Here are some external suggestions:',
            weakMatches: strongInternal.length > 0 ? strongInternal.slice(0, 3) : undefined, // Include weak matches for context
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('Failed to generate external recommendations:', error);
        // Fall through to return the best available internal matches if external generation fails
      }
    }

    // Step 7: Generate reasoning with OpenAI (solution-aware if available)
    console.log('Generating reasoning...');

    // Check if AI solution exists in context
    const hasSolution = context.aiSolution && context.aiSolution.actionableSteps.length > 0;

    let reasoningMap: Map<string, string>;

    if (hasSolution) {
      console.log('Using solution-aware reasoning (references solution steps)');
      // Generate solution-aware reasoning that references the AI solution steps
      reasoningMap = await generateSolutionAwareReasons(
        userContext.problemDescription,
        context.aiSolution!,
        top3
      );
    } else {
      console.log('Using standard reasoning (no AI solution available)');
      // Fallback to standard reasoning
      reasoningMap = await generateRecommendationReasons(
        userContext.problemDescription,
        mergedAnswers,
        top3
      );
    }

    // Attach reasoning to offerings
    const recommendations: ScoredOffering[] = top3.map((so) => ({
      ...so,
      reasoning: reasoningMap.get(so.offering.id) || 'Great match for your needs.',
    }));

    // Step 8: Update conversation with results
    const updatedContext: AdvisorContext = {
      ...context,
      phase: 'complete',
      mode: 'recommending_internal',
      answers: mergedAnswers,
      facts: mergedKnownFacts,
      knownFacts: mergedKnownFacts,
      currentNeedSummary: context.currentNeedSummary || context.detectedIntent,
      recommendationSource: 'internal',
      recommendationIds: recommendations.map((r) => r.offering.id),
      shownRecommendationIds: mergeUniqueIds(
        recommendationState.shownInternalIds,
        recommendations.map((r) => r.offering.id)
      ),
      shownInternalIds: mergeUniqueIds(
        recommendationState.shownInternalIds,
        recommendations.map((r) => r.offering.id)
      ),
      externalRecommendationIds: [],
      availableExternalIds: [],
      shownExternalIds: [],
      lastRecommendationType: 'internal',
      recommendationExhausted: false,
      lastAssistantIntent: 'recommend_for_current_need',
    };

    const updatedMessages = [
      ...((conversation.messages as Prisma.JsonArray | null) || []),
      {
        role: 'user',
        content: `My answers: ${JSON.stringify(mergedAnswers)}`,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: `Based on your needs, I recommend: ${recommendations.map((r) => r.offering.title).join(', ')}`,
        timestamp: new Date().toISOString(),
      },
    ];

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        context: hydrateAdvisorContext(updatedContext) as unknown as Prisma.InputJsonValue,
        messages: updatedMessages as Prisma.InputJsonValue,
        status: 'closed',
        updatedAt: new Date(),
      },
    });

    // Step 9: Return recommendations
    return NextResponse.json(
      {
        recommendations,
      },
      { status: 200 }
    );
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

    console.error('Recommendation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract domain from URL (e.g., "https://www.hubspot.com/products/crm" -> "hubspot.com")
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Generate external product recommendations using OpenAI
 * when no internal offerings match
 */
async function generateExternalRecommendations(
  userContext: UserContext,
  conversationId: string
) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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
          'You are an expert business software advisor. Only suggest well-known, established products. Do NOT invent tools. If unsure about URL, use null. Always return valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5, // Lower temperature for more reliable, factual recommendations
    max_tokens: 2000,
  });

  const content = completion.choices[0].message.content?.trim() || '[]';

  // Parse JSON response
  let recommendations: Array<{
    productName: string;
    productUrl: string | null;
    category: string;
    shortDescription: string;
    reasoning: string;
    confidence: number;
  }>;

  try {
    recommendations = JSON.parse(content);
  } catch {
    console.error('Failed to parse external recommendations:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Fetch existing offerings to filter out duplicates
  const existingOfferings = await prisma.offering.findMany({
    where: { status: 'published' },
    select: { website: true, title: true },
  });

  const existingDomains = new Set(
    existingOfferings
      .map((o) => extractDomain(o.website))
      .filter((domain): domain is string => domain !== null)
  );

  console.log(`Found ${existingDomains.size} existing domains in marketplace`);

  const existingExternalRecommendations = await prisma.externalRecommendation.findMany({
    where: { conversationId },
    select: { productName: true },
  });

  const previouslyShownProducts = existingExternalRecommendations.map(
    (recommendation) => recommendation.productName
  );

  // Filter out products that already exist in our marketplace or that the user rejected.
  const filteredRecommendations = recommendations.filter((rec) => {
    const domain = extractDomain(rec.productUrl);
    const normalizedName = normalizeProductName(rec.productName);
    if (!domain) {
      console.log(`Skipping "${rec.productName}" (no valid URL)`);
      return false;
    }
    if (
      (userContext.rejectedProducts || [])
        .map(normalizeProductName)
        .includes(normalizedName)
    ) {
      console.log(`Skipping "${rec.productName}" (user rejected this product)`);
      return false;
    }
    if (previouslyShownProducts.map(normalizeProductName).includes(normalizedName)) {
      console.log(`Skipping "${rec.productName}" (already shown in conversation)`);
      return false;
    }
    if (existingDomains.has(domain)) {
      console.log(
        `Skipping "${rec.productName}" (domain ${domain} already in marketplace)`
      );
      return false;
    }
    return true;
  });

  console.log(
    `Filtered ${recommendations.length} recommendations down to ${filteredRecommendations.length} (removed duplicates)`
  );

  // Store in database with proper flags
  const storedRecommendations = await Promise.all(
    filteredRecommendations.map((rec) =>
      prisma.externalRecommendation.create({
        data: {
          conversationId,
          productName: rec.productName,
          productUrl: rec.productUrl,
          category: rec.category,
          shortDescription: rec.shortDescription,
          reasoning: rec.reasoning,
          confidence: rec.confidence,
          source: 'ai_generated',
          clickCount: 0,
          potentialLead: true, // Flag for partner acquisition
          verified: false, // Needs manual verification
        },
      })
    )
  );

  console.log(`Stored ${storedRecommendations.length} external recommendations`);
  return storedRecommendations;
}

/**
 * Generate solution-aware reasoning that references AI solution steps
 */
async function generateSolutionAwareReasons(
  userProblem: string,
  aiSolution: { summary: string; actionableSteps: string[] },
  topOfferings: ScoredOffering[]
): Promise<Map<string, string>> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const reasonsMap = new Map<string, string>();

  // Generate reasoning for each offering individually
  for (const scoredOffering of topOfferings) {
    try {
      const prompt = buildReasoningWithSolutionPrompt(
        userProblem,
        aiSolution.actionableSteps,
        scoredOffering
      );

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // Use better model for quality reasoning
        messages: [
          {
            role: 'system',
            content:
              'You are explaining how a specific tool fits into a business solution plan. Always reference solution steps by number.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const reasoning = completion.choices[0]?.message?.content?.trim();
      if (reasoning) {
        reasonsMap.set(scoredOffering.offering.id, reasoning);
      }
    } catch (error) {
      console.error(
        `Failed to generate solution-aware reasoning for ${scoredOffering.offering.title}:`,
        error
      );
      // Fallback reasoning
      reasonsMap.set(
        scoredOffering.offering.id,
        `This ${scoredOffering.offering.offeringType.toLowerCase()} scored ${scoredOffering.matchScore}/100 and aligns well with your strategic needs. ${scoredOffering.offering.shortDescription || ''}`
      );
    }
  }

  return reasonsMap;
}
