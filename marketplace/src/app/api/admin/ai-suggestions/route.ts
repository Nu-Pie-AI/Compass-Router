import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/ai-suggestions
 *
 * Fetch all external recommendations with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (category && category !== 'all') {
      where.category = {
        contains: category,
        mode: 'insensitive',
      };
    }

    if (search) {
      where.productName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Fetch recommendations with pagination
    const [recommendations, total] = await Promise.all([
      prisma.externalRecommendation.findMany({
        where,
        orderBy: [
          { clickCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          productName: true,
          productUrl: true,
          category: true,
          shortDescription: true,
          confidence: true,
          clickCount: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.externalRecommendation.count({ where }),
    ]);

    return NextResponse.json({
      data: recommendations,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
