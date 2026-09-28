// ============================================
// API: Create Partner and Offerings
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { PartnerProfile, OfferingData } from '@/lib/ai/extraction-pipeline';
import { assignCategoryToOffering, getCategoryIdFromSlug } from '@/lib/category-mapper';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title) || `offering-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.offering.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow partners and admins
    if (session.user.role !== 'vendor' && session.user.role !== 'partner' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Only partners/admins can access onboarding' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { partner, offerings, partnerId } = body as {
      partner: PartnerProfile;
      offerings: OfferingData[];
      partnerId?: string; // For admin-initiated onboarding
    };

    if (!partner || !offerings || offerings.length === 0) {
      return NextResponse.json(
        { error: 'Partner and offerings data required' },
        { status: 400 }
      );
    }

    // Determine which partner to update
    let existingPartner;
    let isAdminInitiated = false;

    if (session.user.role === 'admin' && partnerId) {
      // Admin is onboarding a specific partner
      existingPartner = await prisma.partner.findUnique({
        where: { id: partnerId },
      });
      isAdminInitiated = true;
    } else {
      // Partner is onboarding themselves
      existingPartner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
      });
    }

    if (!existingPartner) {
      return NextResponse.json(
        { error: 'Partner record not found. Please contact support.' },
        { status: 404 }
      );
    }

    if (!isAdminInitiated && !isApprovedPartner(existingPartner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    // Verify onboarding status - must be NOT_STARTED or IN_PROGRESS
    if (existingPartner.onboardingStatus === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Partner has already completed onboarding' },
        { status: 400 }
      );
    }

    // Update existing partner with onboarding data
    const partnerRecord = await prisma.partner.update({
      where: { id: existingPartner.id },
      data: {
        companyName: partner.companyName,
        providerType: partner.providerType,
        website: partner.website,
        description: partner.description,
        industry: partner.industry,
        companySize: partner.companySize,
        regions: partner.regions,
        complianceFlags: partner.complianceFlags,
        aiExtracted: true,
        scrapedAt: new Date(),
        overallConfidence: partner.confidenceScore,
        onboardingStatus: 'COMPLETED',
        onboardingMode: isAdminInitiated ? 'ADMIN_INITIATED' : 'SELF_INITIATED',
        onboardedBy: isAdminInitiated ? session.user.id : null,
        status: 'pending',
      },
    });

    // Create offerings
    const createdOfferings = await Promise.all(
      offerings.map(async (offering) => {
        const slug = generateSlug(offering.title);

        // Only update this partner's existing offering. Slug collisions with
        // another partner must create a new slug instead of overwriting theirs.
        const existingOffering = await prisma.offering.findFirst({
          where: { slug, partnerId: partnerRecord.id },
        });

        if (existingOffering) {
          // Update existing offering
          return prisma.offering.update({
            where: { id: existingOffering.id },
            data: {
              title: offering.title,
              shortDescription: offering.shortDescription,
              description: offering.description,
              offeringType: offering.type,
              primaryFunction: offering.primaryFunction,
              subCategory: offering.subCategory,
              useCases: offering.useCases,
              painPointsSolved: offering.painPointsSolved,
              integrations: offering.integrations,
              complianceFlags: offering.complianceFlags,
              learningCurve: offering.learningCurve,
              implementationTime: offering.implementationTime,
              icpTeamSize: offering.idealCustomerProfile.teamSize,
              icpIndustry: offering.idealCustomerProfile.industry,
              icpCompanyStage: offering.idealCustomerProfile.companyStage,
              icpBudget: offering.idealCustomerProfile.budget,
              regions: offering.regions,
              pricingModel: offering.pricingModel,
              startingPrice: offering.startingPrice,
              hasFreeTrial: offering.hasFreeTrial,
              aiGenerated: true,
              confidenceScore: offering.confidenceScore,
              humanReviewed: false,
              status: offering.confidenceScore >= 85 ? 'pending_review' : 'draft',
            },
          });
        } else {
          const uniqueSlug = await generateUniqueSlug(offering.title);
          // Get category ID from AI-provided category slug (fallback to primaryFunction if not provided)
          const categoryId = offering.categorySlug
            ? await getCategoryIdFromSlug(prisma, offering.categorySlug)
            : await assignCategoryToOffering(prisma, offering.primaryFunction);

          // Create new offering
          return prisma.offering.create({
            data: {
              partnerId: partnerRecord.id,
              slug: uniqueSlug,
              title: offering.title,
              shortDescription: offering.shortDescription,
              description: offering.description,
              website: partner.website,
              offeringType: offering.type,
              primaryFunction: offering.primaryFunction,
              subCategory: offering.subCategory,
              useCases: offering.useCases,
              painPointsSolved: offering.painPointsSolved,
              integrations: offering.integrations,
              complianceFlags: offering.complianceFlags,
              learningCurve: offering.learningCurve,
              implementationTime: offering.implementationTime,
              icpTeamSize: offering.idealCustomerProfile.teamSize,
              icpIndustry: offering.idealCustomerProfile.industry,
              icpCompanyStage: offering.idealCustomerProfile.companyStage,
              icpBudget: offering.idealCustomerProfile.budget,
              regions: offering.regions,
              pricingModel: offering.pricingModel,
              startingPrice: offering.startingPrice,
              hasFreeTrial: offering.hasFreeTrial,
              aiGenerated: true,
              confidenceScore: offering.confidenceScore,
              humanReviewed: false,
              status: offering.confidenceScore >= 85 ? 'pending_review' : 'draft',
              // Connect to category if found
              ...(categoryId && {
                categories: {
                  connect: { id: categoryId },
                },
              }),
            },
          });
        }
      })
    );

    // Update partner stats
    await prisma.partner.update({
      where: { id: partnerRecord.id },
      data: {
        totalOfferings: createdOfferings.length,
      },
    });

    // Count offerings by confidence for response
    const highConfidence = createdOfferings.filter((o) => o.confidenceScore && o.confidenceScore >= 85);
    const mediumConfidence = createdOfferings.filter(
      (o) => o.confidenceScore && o.confidenceScore >= 60 && o.confidenceScore < 85
    );
    const lowConfidence = createdOfferings.filter((o) => o.confidenceScore && o.confidenceScore < 60);

    return NextResponse.json({
      success: true,
      partnerId: partnerRecord.id,
      offerings: createdOfferings.map((o) => ({
        id: o.id,
        slug: o.slug,
        title: o.title,
        confidenceScore: o.confidenceScore,
        status: o.status,
      })),
      summary: {
        total: createdOfferings.length,
        highConfidence: highConfidence.length,
        mediumConfidence: mediumConfidence.length,
        lowConfidence: lowConfidence.length,
      },
      message: `Successfully created partner and ${createdOfferings.length} offering(s)`,
    });
  } catch (error: any) {
    console.error('Create partner error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create partner and offerings',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
