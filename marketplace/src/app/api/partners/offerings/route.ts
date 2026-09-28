// ============================================
// API: Get Partner's Offerings & Create New Offering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { assignCategoryToOffering } from '@/lib/category-mapper';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

const createOfferingSchema = z.object({
  title: z.string().min(3),
  shortDescription: z.string().min(20).max(500),
  description: z.string().min(50),
  website: z.string().url().optional().or(z.literal('')),
  // logo: z.string().url().optional().or(z.literal('')),
  logo: z.string().optional(),
  offeringType: z.enum(['PRODUCT', 'SERVICE', 'IMPLEMENTATION', 'TRAINING', 'MANAGED_SERVICE']),
  primaryFunction: z.string().min(1),
  pricingModel: z.enum(['freemium', 'paid', 'custom', 'per-seat', 'per-usage']).optional(),
  startingPrice: z.number().min(0).optional(),
  hasFreeTrial: z.boolean().optional(),
  regions: z.array(z.string()).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Fetch all offerings for this partner
    const offerings = await prisma.offering.findMany({
      where: { partnerId: partner.id },
      select: {
        id: true,
        slug: true,
        title: true,
        offeringType: true,
        status: true,
        confidenceScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(offerings);
  } catch (error: any) {
    console.error('Get offerings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offerings', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Validate request body
    const body = await req.json();
    const validatedData = createOfferingSchema.parse(body);

    // Generate slug from title
    const baseSlug = validatedData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.offering.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Get category ID based on primaryFunction
    const categoryId = await assignCategoryToOffering(prisma, validatedData.primaryFunction);

    // Create offering
    const offering = await prisma.offering.create({
      data: {
        slug,
        title: validatedData.title,
        shortDescription: validatedData.shortDescription,
        description: validatedData.description,
        website: validatedData.website || null,
        logo: validatedData.logo || null,
        offeringType: validatedData.offeringType,
        primaryFunction: validatedData.primaryFunction,
        pricingModel: validatedData.pricingModel || null,
        startingPrice: validatedData.startingPrice || null,
        hasFreeTrial: validatedData.hasFreeTrial || false,
        regions: validatedData.regions,
        partnerId: partner.id,
        status: 'draft', // Start as draft
        aiGenerated: false, // Manually created
        useCases: [], // Can be added in review step
        painPointsSolved: [],
        integrations: [],
        complianceFlags: [],
        icpIndustry: [],
        // Connect to category if found
        ...(categoryId && {
          categories: {
            connect: { id: categoryId },
          },
        }),
      },
    });

    // Update partner offering count
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        totalOfferings: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        id: offering.id,
        slug: offering.slug,
        title: offering.title,
        status: offering.status,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create offering error:', error);
    return NextResponse.json(
      { error: 'Failed to create offering', message: error.message },
      { status: 500 }
    );
  }
}
