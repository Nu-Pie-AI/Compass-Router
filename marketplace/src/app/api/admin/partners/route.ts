import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Build where clause based on status
    const where: any = {};

    if (status !== 'all') {
      if (status === 'pending') {
        where.approvalStatus = 'PENDING';
      } else if (status === 'approved') {
        where.approvalStatus = 'APPROVED';
      } else if (status === 'rejected') {
        where.approvalStatus = 'REJECTED';
      } else if (status === 'suspended') {
        where.status = 'suspended';
      }
    }

    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        include: {
          contacts: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.partner.count({ where }),
    ]);

    return NextResponse.json({
      data: partners,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
