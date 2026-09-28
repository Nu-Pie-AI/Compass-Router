// ============================================
// API: Get Pending Offerings for Admin Review
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch offerings that need review (status = pending_review or draft with AI-generated data)
    const offerings = await prisma.offering.findMany({
      where: {
        OR: [
          { status: 'pending_review' },
          {
            AND: [
              { status: 'draft' },
              { aiGenerated: true },
            ],
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        offeringType: true,
        primaryFunction: true,
        confidenceScore: true,
        status: true,
        aiGenerated: true,
        humanReviewed: true,
        createdAt: true,
        partner: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: [
        { confidenceScore: 'asc' }, // Low confidence first
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(offerings);
  } catch (error: any) {
    console.error('Get pending offerings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending offerings', message: error.message },
      { status: 500 }
    );
  }
}
