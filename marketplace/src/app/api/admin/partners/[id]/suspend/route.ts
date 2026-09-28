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

    const body = await req.json();
    const reason = body?.reason?.trim();

    if (!reason) {
      return NextResponse.json(
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    const [partner] = await prisma.$transaction([
      prisma.partner.update({
        where: { id },
        data: {
          status: 'suspended',
          suspensionReason: reason,
          suspendedAt: new Date(),
        },
      }),
      prisma.partnerStatusHistory.create({
        data: {
          partnerId: id,
          fromStatus: status,
          toStatus: 'suspended',
          reason,
          changedBy: (session.user as any).id,
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Partner suspended successfully',
      partner,
    });

  } catch (error) {
    console.error('Error suspending partner:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}