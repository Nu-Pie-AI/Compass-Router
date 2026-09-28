// ============================================
// API: Start AI Onboarding Session
// Initializes conversation and stores partner inputs
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AIOnboardingContext, StartSessionRequest } from '@/lib/ai-onboarding/types';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

const startSessionSchema = z.object({
  offeringName: z.string().min(3, 'Offering name must be at least 3 characters'),
  offeringSummary: z
    .string()
    .min(60, 'Summary must be at least 60 words')
    .max(500, 'Summary must be less than 500 characters'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  allowWebBrowsing: z.enum(['yes', 'no', 'not-sure']),
  uploadedFileUrls: z.array(z.string()).optional(),
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
    const validatedData = startSessionSchema.parse(body) as StartSessionRequest;
    const isFirstTimeOnboarding = partner.onboardingStatus !== 'COMPLETED';

    // Create initial context
    const initialContext: AIOnboardingContext = {
      phase: 'initialized',
      partnerId: partner.id,
      isFirstTimeOnboarding,
      offeringName: validatedData.offeringName,
      offeringSummary: validatedData.offeringSummary,
      websiteUrl: validatedData.websiteUrl || undefined,
      allowWebBrowsing: validatedData.allowWebBrowsing,
      uploadedFiles: validatedData.uploadedFileUrls?.map((url) => ({
        filename: url.split('/').pop() || 'unknown',
        url,
        type: inferFileType(url),
        size: 0,
      })),
      clarificationRounds: [],
      tokensUsed: {
        stage1: 0,
        stage2: 0,
        refinements: 0,
        total: 0,
      },
    };

    // Create conversation record
    const conversation = await prisma.chatConversation.create({
      data: {
        userId: session.user.id,
        sessionId: generateSessionId(),
        status: 'active',
        messages: [],
        context: initialContext as unknown as Prisma.InputJsonValue,
      },
    });

    if (partner.onboardingStatus === 'NOT_STARTED') {
      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          onboardingStatus: 'IN_PROGRESS',
        },
      });
    }

    console.log('[AI Onboarding] Session started:', conversation.id);

    // Determine next action
    const nextAction = validatedData.websiteUrl
      ? 'extracting'
      : 'generating';

    return NextResponse.json({
      sessionId: conversation.id,
      status: 'initialized' as const,
      message: 'AI onboarding session started successfully',
      nextAction,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[AI Onboarding] Start session error:', error);
    return NextResponse.json(
      {
        error: 'Failed to start session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `ai-onboard-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Infer file type from URL
 */
function inferFileType(url: string): 'pdf' | 'doc' | 'docx' | 'txt' {
  const extension = url.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'doc':
      return 'doc';
    case 'docx':
      return 'docx';
    case 'txt':
      return 'txt';
    default:
      return 'txt';
  }
}
