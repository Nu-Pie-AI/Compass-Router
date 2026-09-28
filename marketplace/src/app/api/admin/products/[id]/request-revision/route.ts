import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendRejectionEmail } from '@/lib/email';

const requestRevisionSchema = z.object({
  notes: z.string().min(10, 'Revision notes must be at least 10 characters'),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validData = requestRevisionSchema.parse(body);

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        approvalStatus: true,
        status: true,
        vendorId: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if product is in pending approval state
    if (product.approvalStatus !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Product is not pending approval' },
        { status: 400 }
      );
    }

    if (!product.vendorId) {
      return NextResponse.json(
        { error: 'Product must have a vendor before requesting revision' },
        { status: 400 }
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: product.vendorId },
      select: {
        companyName: true,
        contactEmail: true,
        user: { select: { name: true } },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Product vendor not found' },
        { status: 400 }
      );
    }

    // Request revision
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Update product status
      const updated = await tx.product.update({
        where: { id },
        data: {
          approvalStatus: 'needs_revision',
          revisionRequested: true,
          revisionNotes: validData.notes,
        },
        include: {
          vendor: {
            select: {
              companyName: true,
              contactEmail: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      // Create status history record
      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: product.approvalStatus,
          toStatus: 'needs_revision',
          changedBy: session.user.id,
          reason: validData.notes,
        },
      });

      return updated;
    });

    await sendRejectionEmail(
      vendor.contactEmail,
      'Product revision',
      validData.notes,
      vendor.user?.name || vendor.companyName
    );

    return NextResponse.json({
      success: true,
      message: 'Revision requested successfully',
      product: updatedProduct,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Request revision error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
