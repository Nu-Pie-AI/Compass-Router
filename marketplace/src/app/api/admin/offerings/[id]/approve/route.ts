// ============================================
// API: Admin Approve Offering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { enrichOfferingExternalRatingsInBackground } from '@/lib/external-ratings';
import { sendApprovalEmail } from '@/lib/email';

export async function POST(
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

    const body = await req.json();
    const { notes } = body;

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    // Get offering
    const offering = await prisma.offering.findUnique({
      where: { id },
      include: { partner: { include: { user: { select: { email: true, name: true } } } } },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    if (offering.status === 'published') {
      return NextResponse.json({
        success: true,
        offering,
        message: 'Offering is already published',
      });
    }

    // Update offering to published
    const updated = await prisma.offering.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        reviewNotes: notes || null,
      },
    });

    // Update partner's published offerings count
    await prisma.partner.update({
      where: { id: offering.partnerId },
      data: {
        publishedOfferings: {
          increment: 1,
        },
      },
    });

    await sendApprovalEmail(offering.partner.user.email, 'Offering', offering.partner.user.name, notes);
    enrichOfferingExternalRatingsInBackground(updated.id);

    return NextResponse.json({
      success: true,
      offering: updated,
      message: 'Offering approved and published successfully',
    });
  } catch (error: unknown) {
    console.error('Approve offering error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to approve offering', message },
      { status: 500 }
    );
  }
}
