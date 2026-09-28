// ============================================
// API: Extract Context (Stage 1)
// Scrapes website and extracts structured facts using GPT-4o-mini
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { scrapeWebsite, extractTextFromHTML } from '@/lib/ai/website-scraper';
import { extractContext } from '@/lib/ai-onboarding/context-extractor';
import { AIOnboardingContext } from '@/lib/ai-onboarding/types';
import { Prisma } from '@prisma/client';

const extractContextSchema = z.object({
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
    const { sessionId } = extractContextSchema.parse(body);

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

    // Extract website text if URL provided
    let websiteText: string | undefined;
    let websiteScraped = false;
    const websiteUrl = context.websiteUrl;

    const shouldBrowseWebsite =
      websiteUrl &&
      context.allowWebBrowsing !== 'no';

    if (shouldBrowseWebsite) {
      try {
        console.log('[Extract Context] Scraping website:', websiteUrl);
        const scraped = await scrapeWebsite(websiteUrl);
        websiteText = extractTextFromHTML(scraped.homepage);
        websiteScraped = true;
        console.log(
          '[Extract Context] Scraped',
          websiteText.length,
          'characters'
        );
      } catch (scrapeError: unknown) {
        console.warn(
          '[Extract Context] Website scraping failed:',
          getErrorMessage(scrapeError)
        );
        // Continue without website data (graceful degradation)
        websiteScraped = false;
      }
    }

    // TODO: Extract text from uploaded files
    // For now, we'll skip file extraction (can be added later)
    const fileContents = undefined;
    const filesProcessed = 0;

    // Run Stage 1: Context extraction
    console.log('[Extract Context] Running Stage 1 extraction...');
    const contextSummary = await extractContext(
      context.offeringName,
      context.offeringSummary,
      websiteText,
      fileContents
    );

    console.log('[Extract Context] Stage 1 complete:', {
      tokensUsed: contextSummary.tokensUsed,
      hasData: contextSummary.product_description.length > 0,
    });

    // Update conversation context
    const updatedContext: AIOnboardingContext = {
      ...context,
      phase: 'context-extracted',
      contextSummary,
      websiteScraped,
      filesProcessed,
      tokensUsed: {
        stage1: contextSummary.tokensUsed,
        stage2: context.tokensUsed?.stage2 || 0,
        refinements: context.tokensUsed?.refinements || 0,
        total: (context.tokensUsed?.total || 0) + contextSummary.tokensUsed,
      },
    };

    await prisma.chatConversation.update({
      where: { id: sessionId },
      data: {
        context: updatedContext as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      contextSummary,
      tokensUsed: contextSummary.tokensUsed,
      websiteScraped,
      filesProcessed,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Extract Context] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract context',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
