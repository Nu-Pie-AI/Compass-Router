import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Get pending products with vendor info
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: {
          approvalStatus: 'pending_approval',
        },
        include: {
          vendor: {
            select: {
              id: true,
              companyName: true,
              contactEmail: true,
            },
          },
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          screenshots: {
            select: {
              id: true,
              url: true,
              title: true,
              order: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          submittedForApprovalAt: 'asc', // Oldest first (FIFO)
        },
        skip,
        take: limit,
      }),
      prisma.product.count({
        where: {
          approvalStatus: 'pending_approval',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Fetch pending products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
