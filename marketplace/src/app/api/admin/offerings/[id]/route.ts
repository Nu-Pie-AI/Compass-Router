// ============================================
// API: Get Single Offering for Admin Review
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    // Fetch offering with full details
    const offering = await prisma.offering.findUnique({
      where: { id },
      include: {
        partner: {
          select: {
            id: true,
            companyName: true,
            website: true,
          },
        },
        externalRatings: {
          orderBy: { source: 'asc' },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    return NextResponse.json(offering);
  } catch (error: unknown) {
    console.error('Get offering error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch offering', message },
      { status: 500 }
    );
  }
}
