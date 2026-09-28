import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * POST /api/ai-advisor/external/[id]/click
 *
 * Track when a user clicks on an external recommendation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Increment click count
    const recommendation = await prisma.externalRecommendation.update({
      where: { id },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        clickCount: recommendation.clickCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error tracking external recommendation click:', error);

    // Don't fail the request if tracking fails
    return NextResponse.json(
      {
        success: false,
        message: 'Click tracking failed',
      },
      { status: 200 }
    );
  }
}
