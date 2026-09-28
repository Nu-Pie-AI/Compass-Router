import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all statistics in parallel for performance
    const [
      // Partner counts
      totalPartners,
      pendingPartners,
      approvedPartners,
      rejectedPartners,
      suspendedPartners,

      // Offering counts
      totalOfferings,
      notSubmittedOfferings,
      pendingApprovalOfferings,
      approvedOfferings,
      needsRevisionOfferings,
      publishedOfferings,
      draftOfferings,

      // Recent partner activity
      recentPartners,

      // Recent offering activity
      recentOfferings,
    ] = await Promise.all([
      // Partner statistics
      prisma.partner.count(),
      prisma.partner.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.partner.count({ where: { approvalStatus: 'APPROVED' } }),
      prisma.partner.count({ where: { approvalStatus: 'REJECTED' } }),
      prisma.partner.count({ where: { status: 'suspended' } }),

      // Offering statistics
      prisma.offering.count(),
      prisma.offering.count({ where: { approvalStatus: 'not_submitted' } }),
      prisma.offering.count({ where: { approvalStatus: 'pending_approval' } }),
      prisma.offering.count({ where: { approvalStatus: 'approved' } }),
      prisma.offering.count({ where: { approvalStatus: 'needs_revision' } }),
      prisma.offering.count({ where: { status: 'published' } }),
      prisma.offering.count({ where: { status: 'draft' } }),

      // Recent activity - last 5 partners
      prisma.partner.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          approvalStatus: true,
          status: true,
          createdAt: true,
        },
      }),

      // Recent activity - last 5 offerings
      prisma.offering.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        where: {
          OR: [
            { approvalStatus: 'pending_approval' },
            { approvalStatus: 'approved' },
          ],
        },
        select: {
          id: true,
          title: true,
          approvalStatus: true,
          updatedAt: true,
        },
      }),
    ]);

    // Format recent activity
    const recentActivity = [
      ...recentPartners.map(partner => ({
        id: partner.id,
        type: 'partner' as const,
        action: `Partner ${partner.approvalStatus.toLowerCase()}`,
        entity: partner.companyName,
        timestamp: partner.createdAt.toISOString(),
      })),
      ...recentOfferings.map(offering => ({
        id: offering.id,
        type: 'offering' as const,
        action: `Offering ${offering.approvalStatus.replace(/_/g, ' ')}`,
        entity: offering.title,
        timestamp: offering.updatedAt.toISOString(),
      })),
    ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

    const stats = {
      partners: {
        total: totalPartners,
        pending: pendingPartners,
        approved: approvedPartners,
        rejected: rejectedPartners,
        suspended: suspendedPartners,
      },
      offerings: {
        total: totalOfferings,
        notSubmitted: notSubmittedOfferings,
        pendingApproval: pendingApprovalOfferings,
        approved: approvedOfferings,
        needsRevision: needsRevisionOfferings,
        published: publishedOfferings,
        draft: draftOfferings,
      },
      recentActivity,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
