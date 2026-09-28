import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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

    const { reason } = await req.json();

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.status === 'suspended') {
      return NextResponse.json(
        { error: 'Vendor is already suspended' },
        { status: 400 }
      );
    }

    // Perform suspension in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Archive all published products
      const publishedProducts = vendor.products.filter(
        (p) => p.status === 'published'
      );

      if (publishedProducts.length > 0) {
        await tx.product.updateMany({
          where: {
            vendorId: vendor.id,
            status: 'published',
          },
          data: {
            status: 'archived',
            archivedAt: new Date(),
            archivedBy: session.user.id,
          },
        });

        // Create status history for each archived product
        await Promise.all(
          publishedProducts.map((product) =>
            tx.productStatusHistory.create({
              data: {
                productId: product.id,
                fromStatus: 'published',
                toStatus: 'archived',
                changedBy: session.user.id,
                reason: `Vendor suspended: ${reason}`,
              },
            })
          )
        );
      }

      // Update vendor status
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: {
          status: 'suspended',
          suspendedAt: new Date(),
          suspendedBy: session.user.id,
          suspensionReason: reason,
        },
      });

      // Create vendor status history
      await tx.vendorStatusHistory.create({
        data: {
          vendorId: vendor.id,
          fromStatus: vendor.status,
          toStatus: 'suspended',
          changedBy: session.user.id,
          reason,
          metadata: {
            archivedProductsCount: publishedProducts.length,
          },
        },
      });

      return {
        vendor: updatedVendor,
        archivedProductsCount: publishedProducts.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Vendor suspended successfully. ${result.archivedProductsCount} products archived.`,
      vendor: result.vendor,
      archivedProductsCount: result.archivedProductsCount,
    });
  } catch (error) {
    console.error('Vendor suspension error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
