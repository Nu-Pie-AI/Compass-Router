import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
      },
      include: { user: { select: { email: true, name: true } } },
    });

    await sendApprovalEmail(vendor.user.email, 'Vendor account', vendor.user.name);

    return NextResponse.json({
      success: true,
      message: 'Vendor approved successfully',
      vendor,
    });
  } catch (error) {
    console.error('Vendor approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
