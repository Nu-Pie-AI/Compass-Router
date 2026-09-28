// ============================================
// API: Get and Update Single Offering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    // Get partner for current user
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 });
    }

    if (!isApprovedPartner(partner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    // Fetch offering (must belong to this partner)
    const offering = await prisma.offering.findFirst({
      where: {
        id,
        partnerId: partner.id,
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    return NextResponse.json(offering);
  } catch (error: any) {
    console.error('Get offering error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offering', message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    // Get partner for current user
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 });
    }

    if (!isApprovedPartner(partner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    // Verify offering belongs to this partner
    const existing = await prisma.offering.findFirst({
      where: {
        id,
        partnerId: partner.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    // Update offering
    const updated = await prisma.offering.update({
      where: { id },
      data: {
        title: body.title,
        shortDescription: body.shortDescription,
        description: body.description,
        offeringType: body.offeringType,
        primaryFunction: body.primaryFunction,
        subCategory: body.subCategory,
        useCases: body.useCases,
        painPointsSolved: body.painPointsSolved,
        integrations: body.integrations,
        complianceFlags: body.complianceFlags,
        learningCurve: body.learningCurve,
        implementationTime: body.implementationTime,
        icpTeamSize: body.icpTeamSize,
        icpIndustry: body.icpIndustry,
        icpCompanyStage: body.icpCompanyStage,
        icpBudget: body.icpBudget,
        regions: body.regions,
        pricingModel: body.pricingModel,
        startingPrice: body.startingPrice,
        hasFreeTrial: body.hasFreeTrial,
        humanReviewed: true,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update offering error:', error);
    return NextResponse.json(
      { error: 'Failed to update offering', message: error.message },
      { status: 500 }
    );
  }
}
