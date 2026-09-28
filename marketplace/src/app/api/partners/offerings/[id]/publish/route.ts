// ============================================
// API: Publish Offering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { notifyAdmin } from '@/lib/email';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    // Get partner for current user
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 });
    }

    if (!isApprovedPartner(partner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    // Verify offering belongs to this partner
    const offering = await prisma.offering.findFirst({
      where: {
        id,
        partnerId: partner.id,
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    if (offering.status === 'pending_review') {
      return NextResponse.json({
        success: true,
        offering,
        message: 'Offering is already submitted for review.',
      });
    }

    const updated = await prisma.offering.update({
      where: { id },
      data: {
        status: 'pending_review',
        publishedAt: null,
      },
    });

    await notifyAdmin(
      'Offering submitted for review',
      `${offering.title} was submitted by ${partner.companyName || partner.user.email}.`,
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/offerings/review`
    );

    return NextResponse.json({
      success: true,
      offering: updated,
      message: 'Offering submitted for review. Admin will review before publishing.',
    });
  } catch (error: unknown) {
    console.error('Publish offering error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to publish offering', message },
      { status: 500 }
    );
  }
}
