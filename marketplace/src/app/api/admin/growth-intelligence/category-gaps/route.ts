import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/growth-intelligence/category-gaps
 *
 * Analyze external recommendations by category to identify unmet demand areas
 * Shows which categories users are asking for but we don't have offerings in
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Group external recommendations by category and count
    const categoryGaps = await prisma.externalRecommendation.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
      _avg: {
        confidence: true,
        clickCount: true,
      },
      orderBy: {
        _count: {
          id: 'desc', // Order by most requested
        },
      },
    });

    // For each category, check how many internal offerings we have
    const enrichedGaps = await Promise.all(
      categoryGaps.map(async (gap) => {
        const internalOfferingsCount = await prisma.offering.count({
          where: {
            status: 'published',
            OR: [
              {
                primaryFunction: {
                  contains: gap.category,
                  mode: 'insensitive',
                },
              },
              {
                categories: {
                  some: {
                    slug: {
                      contains: gap.category,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          },
        });

        return {
          category: gap.category,
          externalRequestCount: gap._count.id,
          averageConfidence: gap._avg.confidence,
          averageClickCount: gap._avg.clickCount,
          internalOfferingsCount,
          gapScore:
            internalOfferingsCount === 0
              ? gap._count.id * 2 // Double the score if we have ZERO offerings
              : gap._count.id / Math.max(1, internalOfferingsCount), // Ratio of demand to supply
        };
      })
    );

    // Sort by gap score (highest priority first)
    enrichedGaps.sort((a, b) => b.gapScore - a.gapScore);

    return NextResponse.json(
      {
        gaps: enrichedGaps,
        summary: {
          totalCategories: enrichedGaps.length,
          categoriesWithZeroOfferings: enrichedGaps.filter(
            (g) => g.internalOfferingsCount === 0
          ).length,
          totalExternalRequests: enrichedGaps.reduce(
            (sum, g) => sum + g.externalRequestCount,
            0
          ),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error analyzing category gaps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
