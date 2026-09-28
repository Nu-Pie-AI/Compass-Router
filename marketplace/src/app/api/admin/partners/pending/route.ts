// ============================================
// API: Get Pending Partner Approvals (Admin Only)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch partners with PENDING approval status
    const partners = await prisma.partner.findMany({
      where: {
        approvalStatus: 'PENDING',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    });

    return NextResponse.json({
      success: true,
      partners: partners.map((p) => ({
        id: p.id,
        companyName: p.companyName,
        userName: p.user.name,
        userEmail: p.user.email,
        createdAt: p.createdAt,
        providerType: p.providerType,
      })),
    });
  } catch (error: any) {
    console.error('Get pending partners error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending partners', message: error.message },
      { status: 500 }
    );
  }
}
