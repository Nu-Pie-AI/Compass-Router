// ============================================
// API: Get Partner Approval Status
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

    // Get partner record
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: {
        approvalStatus: true,
        companyName: true,
        createdAt: true,
        rejectionReason: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      approvalStatus: partner.approvalStatus,
      companyName: partner.companyName,
      createdAt: partner.createdAt,
      rejectionReason: partner.rejectionReason,
    });
  } catch (error: any) {
    console.error('Get approval status error:', error);
    return NextResponse.json(
      { error: 'Failed to get approval status', message: error.message },
      { status: 500 }
    );
  }
}
