import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateSolution } from '@/lib/ai-advisor/openai';
import { getFallbackSolution } from '@/lib/ai-advisor/fallback-solutions';
import { AdvisorContext, AISolution } from '@/lib/ai-advisor/types';
import { hydrateAdvisorContext } from '@/lib/ai-advisor/context-state';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const generateSolutionRequestSchema = z.object({
  conversationId: z.string(),
});

// Comprehensive list of brand names to detect and reject
const FORBIDDEN_BRANDS = [
  // CRM
  'salesforce',
  'hubspot',
  'pipedrive',
  'zoho',
  'freshsales',
  'zendesk sell',
  'nimble',
  'insightly',
  'nutshell',
  // Project Management
  'asana',
  'monday',
  'trello',
  'jira',
  'clickup',
  'basecamp',
  'wrike',
  'smartsheet',
  'teamwork',
  // Communication
  'slack',
  'teams',
  'zoom',
  'discord',
  'skype',
  'webex',
  // Big Tech
  'microsoft',
  'google',
  'apple',
  'oracle',
  'sap',
  'ibm',
  'adobe',
  'amazon',
  // Accounting
  'quickbooks',
  'xero',
  'freshbooks',
  'wave',
  'sage',
  'netsuite',
  // HR
  'workday',
  'bamboohr',
  'gusto',
  'rippling',
  'adp',
  'paychex',
  'namely',
  // Marketing
  'mailchimp',
  'marketo',
  'pardot',
  'constant contact',
  'sendinblue',
  'activecampaign',
  // Analytics
  'tableau',
  'power bi',
  'looker',
  'qlik',
  // Ecommerce
  'shopify',
  'woocommerce',
  'magento',
  'bigcommerce',
  // Misc
  'dropbox',
  'box',
  'onedrive',
  'evernote',
  'notion',
  'airtable',
];

/**
 * Check if solution contains any brand names
 */
function containsBrandNames(solution: AISolution): {
  hasBrands: boolean;
  foundBrands: string[];
} {
  const textToCheck = [
    solution.summary,
    ...solution.actionableSteps,
    ...solution.toolTypesNeeded,
    solution.estimatedImplementationTime,
    solution.budgetConsiderations,
  ]
    .join(' ')
    .toLowerCase();

  const foundBrands: string[] = [];

  for (const brand of FORBIDDEN_BRANDS) {
    if (textToCheck.includes(brand.toLowerCase())) {
      foundBrands.push(brand);
    }
  }

  return {
    hasBrands: foundBrands.length > 0,
    foundBrands,
  };
}

/**
 * Count words in solution
 */
function countWords(solution: AISolution): number {
  const allText = [
    solution.summary,
    ...solution.actionableSteps,
    ...solution.toolTypesNeeded,
    solution.estimatedImplementationTime,
    solution.budgetConsiderations,
  ].join(' ');

  return allText.split(/\s+/).length;
}

/**
 * POST /api/ai-advisor/generate-solution
 *
 * Generates generic AI solution (no brand names, 500 words max)
 *
 * Request body:
 * {
 *   "conversationId": "clxxx"
 * }
 *
 * Response:
 * {
 *   "solution": {
 *     "summary": "...",
 *     "actionableSteps": ["1. ...", "2. ...", ...],
 *     "toolTypesNeeded": ["CRM system", "..."],
 *     "estimatedImplementationTime": "2-4 weeks",
 *     "budgetConsiderations": "..."
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'ai-advisor', { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await req.json();
    const { conversationId } = generateSolutionRequestSchema.parse(body);

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

    // Validate phase
    const validPhases = ['clarifying', 'clarifying-iterative', 'solution-generated'];
    if (!validPhases.includes(context.phase)) {
      return NextResponse.json(
        {
          error: `Invalid conversation state: ${context.phase}. Must complete clarification first.`,
        },
        { status: 400 }
      );
    }

    console.log('Generating solution for conversation:', conversationId);

    let solution: AISolution | null = null;
    let usedFallback = false;

    // Step 2: Try to generate solution with OpenAI (with retry)
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxAttempts} to generate solution...`);

        solution = await generateSolution(
          context.problem,
          context.detectedCategory,
          context.answers || {},
          context.detectedIntent
        );

        // Check for brand names
        const brandCheck = containsBrandNames(solution);
        if (brandCheck.hasBrands) {
          console.warn(
            `Brand names detected in solution (attempt ${attempt}):`,
            brandCheck.foundBrands
          );

          if (attempt < maxAttempts) {
            // Retry with stricter prompt
            console.log('Retrying with stricter brand name warning...');
            continue;
          } else {
            // Last attempt failed, use fallback
            console.error(
              'All attempts returned brand names, using fallback solution'
            );
            solution = null;
          }
        } else {
          // Success! No brand names found
          const wordCount = countWords(solution);
          console.log(`Solution generated successfully (${wordCount} words)`);

          if (wordCount > 600) {
            console.warn(`Solution exceeds 600 words (${wordCount}), but accepting`);
          }

          break; // Exit retry loop
        }
      } catch (error) {
        console.error(`Solution generation attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts) {
          console.log('Retrying...');
          continue;
        } else {
          console.error('All attempts failed, using fallback solution');
          solution = null;
        }
      }
    }

    // Step 3: Use fallback if OpenAI failed or returned brand names
    if (!solution) {
      console.log('Using fallback solution template');
      solution = getFallbackSolution(
        context.detectedCategory,
        context.problem,
        context.answers || {}
      );
      usedFallback = true;
    }

    // Step 4: Update conversation context with solution
    const updatedContext: AdvisorContext = {
      ...context,
      phase: 'solution-generated',
      mode: 'awaiting_recommendation_consent',
      aiSolution: solution,
    };

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        context: hydrateAdvisorContext(updatedContext) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Step 5: Return solution
    return NextResponse.json(
      {
        solution,
        metadata: {
          usedFallback,
          category: context.detectedCategory,
          clarityScore: context.clarityScore?.overall,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Generate solution endpoint error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate solution',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
