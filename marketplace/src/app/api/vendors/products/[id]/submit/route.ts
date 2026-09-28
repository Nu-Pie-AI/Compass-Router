import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { notifyAdmin } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Check if vendor is approved
    if (vendor.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved vendors can submit products for review' },
        { status: 403 }
      );
    }

    // Check if product exists and belongs to vendor
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        vendorId: true,
        approvalStatus: true,
        status: true,
        name: true,
        description: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.vendorId !== vendor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if product is already submitted or approved
    if (product.approvalStatus === 'pending_approval') {
      return NextResponse.json(
        { error: 'Product is already pending approval' },
        { status: 400 }
      );
    }

    if (product.approvalStatus === 'approved' && product.status === 'published') {
      return NextResponse.json(
        { error: 'Product is already approved and published' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!product.name || !product.description) {
      return NextResponse.json(
        { error: 'Product must have a name and description before submission' },
        { status: 400 }
      );
    }

    // Submit product for approval
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        approvalStatus: 'pending_approval',
        submittedForApprovalAt: new Date(),
        revisionRequested: false,
        revisionNotes: null,
      },
    });

    // Create status history record
    await prisma.productStatusHistory.create({
      data: {
        productId: id,
        fromStatus: product.approvalStatus,
        toStatus: 'pending_approval',
        changedBy: session.user.id,
      },
    });

    await notifyAdmin(
      'Product submitted for approval',
      `${product.name} was submitted for approval by a vendor.`,
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/products/pending`
    );

    return NextResponse.json({
      success: true,
      message: 'Product submitted for approval successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Product submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
