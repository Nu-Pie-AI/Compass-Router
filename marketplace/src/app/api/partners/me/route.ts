// ============================================
// API: Get Current User's Partner Profile
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

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 });
    }

    return NextResponse.json(partner);
  } catch (error: any) {
    console.error('Get partner error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner profile', message: error.message },
      { status: 500 }
    );
  }
}
