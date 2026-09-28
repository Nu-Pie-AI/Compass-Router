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

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.status !== 'suspended') {
      return NextResponse.json(
        { error: 'Vendor is not suspended' },
        { status: 400 }
      );
    }

    // Perform reinstatement in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Restore archived products (only those archived by suspension)
      const archivedProducts = vendor.products.filter(
        (p) => p.status === 'archived' && p.archivedBy === vendor.suspendedBy
      );

      if (archivedProducts.length > 0) {
        // Restore products to published status
        await tx.product.updateMany({
          where: {
            vendorId: vendor.id,
            status: 'archived',
            archivedBy: vendor.suspendedBy,
          },
          data: {
            status: 'published',
            archivedAt: null,
            archivedBy: null,
          },
        });

        // Create status history for each restored product
        await Promise.all(
          archivedProducts.map((product) =>
            tx.productStatusHistory.create({
              data: {
                productId: product.id,
                fromStatus: 'archived',
                toStatus: 'published',
                changedBy: session.user.id,
                reason: 'Vendor reinstated',
              },
            })
          )
        );
      }

      // Update vendor status back to approved
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: {
          status: 'approved',
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
        },
      });

      // Create vendor status history
      await tx.vendorStatusHistory.create({
        data: {
          vendorId: vendor.id,
          fromStatus: 'suspended',
          toStatus: 'approved',
          changedBy: session.user.id,
          reason: 'Vendor reinstated by admin',
          metadata: {
            restoredProductsCount: archivedProducts.length,
          },
        },
      });

      return {
        vendor: updatedVendor,
        restoredProductsCount: archivedProducts.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Vendor reinstated successfully. ${result.restoredProductsCount} products restored.`,
      vendor: result.vendor,
      restoredProductsCount: result.restoredProductsCount,
    });
  } catch (error) {
    console.error('Vendor reinstatement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
