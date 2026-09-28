// ============================================
// API: Validate Onboarding Access (Server-Side Check)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({
        allowed: false,
        redirectTo: '/auth/signin',
        reason: 'Not authenticated'
      }, { status: 401 });
    }

    const { partnerId } = await req.json();

    // RULE 1: Partner can only onboard themselves (no partnerId param)
    if (session.user.role === 'partner' || session.user.role === 'vendor') {
      if (partnerId) {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/partners/dashboard',
          reason: 'Partners cannot onboard other partners'
        }, { status: 403 });
      }

      // Get partner's own record
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
      });

      if (!partner) {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/partners/dashboard',
          reason: 'Partner record not found'
        }, { status: 404 });
      }

      // RULE 2: If already COMPLETED, redirect to dashboard
      if (partner.onboardingStatus === 'COMPLETED') {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/partners/dashboard',
          reason: 'Onboarding already completed'
        }, { status: 403 });
      }

      return NextResponse.json({
        allowed: true,
        partnerRecord: {
          id: partner.id,
          onboardingStatus: partner.onboardingStatus,
        }
      });
    }

    // RULE 3: Admin can onboard any NOT_STARTED partner (must pass partnerId)
    if (session.user.role === 'admin') {
      if (!partnerId) {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/admin/partners/initiate-onboarding',
          reason: 'Admin must select a partner to onboard'
        }, { status: 400 });
      }

      // Verify the partner exists
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
      });

      if (!partner) {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/admin/partners/initiate-onboarding',
          reason: 'Partner not found'
        }, { status: 404 });
      }

      // RULE 4: If already COMPLETED, redirect admin back
      if (partner.onboardingStatus === 'COMPLETED') {
        return NextResponse.json({
          allowed: false,
          redirectTo: '/admin/partners/initiate-onboarding',
          reason: 'Partner has already completed onboarding'
        }, { status: 403 });
      }

      return NextResponse.json({
        allowed: true,
        partnerRecord: {
          id: partner.id,
          companyName: partner.companyName,
          onboardingStatus: partner.onboardingStatus,
        }
      });
    }

    // If not partner or admin, reject
    return NextResponse.json({
      allowed: false,
      redirectTo: '/',
      reason: 'Insufficient permissions'
    }, { status: 403 });

  } catch (error: any) {
    console.error('Validate access error:', error);
    return NextResponse.json(
      {
        allowed: false,
        redirectTo: '/',
        reason: 'Server error during access validation',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
