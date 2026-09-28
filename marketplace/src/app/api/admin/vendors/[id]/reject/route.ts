import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendRejectionEmail } from '@/lib/email';

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

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'Your vendor application was not approved at this time.';

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      include: { user: { select: { email: true, name: true } } },
    });

    await sendRejectionEmail(vendor.user.email, 'Vendor account', reason, vendor.user.name);

    return NextResponse.json({
      success: true,
      message: 'Vendor rejected successfully',
      vendor,
    });
  } catch (error) {
    console.error('Vendor rejection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
