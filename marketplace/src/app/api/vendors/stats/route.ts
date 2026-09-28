import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalProducts, totalViews, totalReviews, totalLeads] = await Promise.all([
      prisma.product.count({ where: { vendorId: vendor.id } }),
      // prisma.productView.aggregate({
      prisma.productView.count({
        where: {
          product: { vendorId: vendor.id },
          createdAt: { gte: thirtyDaysAgo },
        },
        // _sum: { viewCount: true },
      }),
      prisma.review.count({
        where: { product: { vendorId: vendor.id } },
      }),
      prisma.vendorContact.count({
        where: { vendorId: vendor.id, status: 'new' },
      }),
    ]);

    return NextResponse.json({
      totalProducts,
      totalViews,
      // totalViews: totalViews._sum.viewCount || 0,
      totalReviews,
      totalLeads,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
