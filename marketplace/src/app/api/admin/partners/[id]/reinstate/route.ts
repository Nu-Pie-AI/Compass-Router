import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.update({
      where: { id },
      data: {
        status: 'active',
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    await prisma.partnerStatusHistory.create({
      data: {
        partnerId: partner.id,
        fromStatus: partner.status,
        toStatus: 'active',
        reason: 'Partner reinstated by admin',
        changedBy: (session.user as any).id,
      },
    });

    return NextResponse.json({
      message: 'Partner reinstated successfully',
      partner,
    });

  } catch (error) {
    console.error('Error reinstating partner:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}