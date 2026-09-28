// ============================================
// API: Admin Reject Offering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendRejectionEmail } from '@/lib/email';

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
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

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

    // Update offering status to rejected
    const updated = await prisma.offering.update({
      where: { id },
      data: {
        status: 'draft', // Send back to draft so partner can fix
        reviewNotes: reason,
      },
    });

    await sendRejectionEmail(offering.partner.user.email, 'Offering', reason, offering.partner.user.name);

    return NextResponse.json({
      success: true,
      offering: updated,
      message: 'Offering rejected. Partner has been notified.',
    });
  } catch (error: unknown) {
    console.error('Reject offering error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to reject offering', message },
      { status: 500 }
    );
  }
}
