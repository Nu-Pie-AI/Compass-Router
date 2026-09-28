// ============================================
// API: Approve Partner Account (Admin Only)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
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

    // Check if already approved
    if (partner.approvalStatus === 'APPROVED') {
      return NextResponse.json(
        { error: 'Partner is already approved' },
        { status: 400 }
      );
    }

    // Update partner approval status
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: session.user.id,
        status: 'approved',
      },
    });

    await sendApprovalEmail(partner.user.email, 'Partner account', partner.user.name);
    // TODO: Log approval action

    return NextResponse.json({
      success: true,
      partner: updatedPartner,
      message: `Partner ${partner.companyName || partner.user.name} has been approved`,
    });
  } catch (error: any) {
    console.error('Approve partner error:', error);
    return NextResponse.json(
      { error: 'Failed to approve partner', message: error.message },
      { status: 500 }
    );
  }
}
