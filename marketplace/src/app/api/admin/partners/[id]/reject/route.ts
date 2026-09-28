// ============================================
// API: Reject Partner Account (Admin Only)
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

    const { id } = await params;

    // Get partner
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if already rejected
    if (partner.approvalStatus === 'REJECTED') {
      return NextResponse.json(
        { error: 'Partner is already rejected' },
        { status: 400 }
      );
    }

    // Update partner approval status
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: reason,
        approvedBy: session.user.id, // Track who rejected
        status: 'rejected',
      },
    });

    await sendRejectionEmail(partner.user.email, 'Partner account', reason, partner.user.name);
    // TODO: Log rejection action

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
      message: `Partner ${partner.companyName || partner.user.name} has been rejected`,
    });
  } catch (error: any) {
    console.error('Reject partner error:', error);
    return NextResponse.json(
      { error: 'Failed to reject partner', message: error.message },
      { status: 500 }
    );
  }
}
