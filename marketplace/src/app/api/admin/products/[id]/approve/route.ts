import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';

const approveSchema = z.object({
  notes: z.string().optional(),
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
    const validData = approveSchema.parse(body);

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        approvalStatus: true,
        status: true,
        vendorId: true,
        currentVersion: true,
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
        { error: 'Product must have a vendor before approval' },
        { status: 400 }
      );
    }
    const vendorId = product.vendorId;

    // Get vendor to check if approved
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        status: true,
        companyName: true,
        contactEmail: true,
        user: { select: { name: true } },
      },
    });

    if (!vendor || vendor.status !== 'approved') {
      return NextResponse.json(
        { error: 'Vendor must be approved before product approval' },
        { status: 400 }
      );
    }

    // Approve product and publish it
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Update product status
      const updated = await tx.product.update({
        where: { id },
        data: {
          approvalStatus: 'approved',
          approvedAt: new Date(),
          approvedBy: session.user.id,
          status: 'published',
          publishedAt: new Date(),
          revisionRequested: false,
          revisionNotes: null,
        },
        include: {
          vendor: {
            select: {
              companyName: true,
              contactEmail: true,
              user: { select: { name: true } },
            },
          },
          categories: true,
        },
      });

      // Create status history record
      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: product.approvalStatus,
          toStatus: 'approved',
          changedBy: session.user.id,
          reason: validData.notes || 'Product approved by admin',
        },
      });

      // Create product version for the approved state
      await tx.productVersion.create({
        data: {
          productId: id,
          version: product.currentVersion,
          name: updated.name,
          description: updated.description || '',
          changes: {
            approvalStatus: 'approved',
            status: 'published',
            approvedAt: updated.approvedAt,
            approvedBy: session.user.id,
          },
          createdBy: session.user.id,
        },
      });

      // Update vendor product counts
      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          publishedProducts: { increment: 1 },
          pendingProducts: { decrement: 1 },
        },
      });

      return updated;
    });

    await sendApprovalEmail(
      vendor.contactEmail,
      'Product',
      vendor.user?.name || vendor.companyName,
      validData.notes
    );

    return NextResponse.json({
      success: true,
      message: 'Product approved and published successfully',
      product: updatedProduct,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Product approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
