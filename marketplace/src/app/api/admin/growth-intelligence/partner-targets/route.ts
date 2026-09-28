import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Extract domain from URL
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

type PartnerTarget = {
  productName: string;
  domain: string | null;
  category: string;
  requestCount: number;
  totalClicks: number;
  averageConfidence: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sampleUrls: string[];
};

type PartnerTargetWithScore = PartnerTarget & {
  acquisitionScore: number;
};

/**
 * GET /api/admin/growth-intelligence/partner-targets
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const minRequests = parseInt(searchParams.get('minRequests') || '2');
    const limit = parseInt(searchParams.get('limit') || '50');

    const allRecommendations = await prisma.externalRecommendation.findMany({
      select: {
        productName: true,
        productUrl: true,
        category: true,
        confidence: true,
        clickCount: true,
        potentialLead: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const targetsMap = new Map<string, PartnerTarget>();

    allRecommendations.forEach((rec) => {
      const domain = extractDomain(rec.productUrl);
      const key = domain || rec.productName.toLowerCase();

      if (targetsMap.has(key)) {
        const existing = targetsMap.get(key)!;

        existing.requestCount++;
        existing.totalClicks += rec.clickCount;

        existing.averageConfidence =
          (existing.averageConfidence * (existing.requestCount - 1) +
            rec.confidence) /
          existing.requestCount;

        existing.lastSeenAt =
          rec.createdAt > existing.lastSeenAt
            ? rec.createdAt
            : existing.lastSeenAt;

        if (rec.productUrl && !existing.sampleUrls.includes(rec.productUrl)) {
          existing.sampleUrls.push(rec.productUrl);
        }
      } else {
        targetsMap.set(key, {
          productName: rec.productName,
          domain,
          category: rec.category,
          requestCount: 1,
          totalClicks: rec.clickCount,
          averageConfidence: rec.confidence,
          firstSeenAt: rec.createdAt,
          lastSeenAt: rec.createdAt,
          sampleUrls: rec.productUrl ? [rec.productUrl] : [],
        });
      }
    });

    const filteredTargets: PartnerTarget[] = Array.from(
      targetsMap.values()
    ).filter((t) => t.requestCount >= minRequests);

    const targetsWithScore: PartnerTargetWithScore[] = filteredTargets.map(
      (target) => ({
        ...target,
        acquisitionScore:
          target.requestCount * 10 +
          target.totalClicks * 5 +
          target.averageConfidence * 20,
      })
    );

    targetsWithScore.sort(
      (a, b) => b.acquisitionScore - a.acquisitionScore
    );

    const topTargets = targetsWithScore.slice(0, limit);

    return NextResponse.json(
      {
        targets: topTargets,
        summary: {
          totalUniqueProducts: targetsWithScore.length,
          totalRequests: targetsWithScore.reduce(
            (sum, t) => sum + t.requestCount,
            0
          ),
          totalClicks: targetsWithScore.reduce(
            (sum, t) => sum + t.totalClicks,
            0
          ),
          averageRequestsPerProduct:
            targetsWithScore.length > 0
              ? (
                  targetsWithScore.reduce(
                    (sum, t) => sum + t.requestCount,
                    0
                  ) / targetsWithScore.length
                ).toFixed(1)
              : 0,
        },
        filters: {
          minRequests,
          limit,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error analyzing partner targets:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}