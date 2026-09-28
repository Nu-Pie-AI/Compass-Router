import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface PublicOfferingResponse {
  id: string;
  slug: string;
  title: string;
  status: string;
}

interface PublicExternalRating {
  id: string;
  source: string;
  rating: number;
  reviewCount: number;
  url?: string | null;
  lastSyncedAt?: Date | string | null;
}

async function getExternalRatings(offeringId: string): Promise<PublicExternalRating[]> {
  try {
    return await prisma.$queryRaw<PublicExternalRating[]>`
      SELECT
        "id",
        "source"::text AS "source",
        "rating",
        "reviewCount",
        "url",
        "lastSyncedAt"
      FROM "external_ratings"
      WHERE "offeringId" = ${offeringId}
      ORDER BY "source" ASC
    `;
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const findOffering = prisma.offering.findFirst as unknown as (
      args: unknown
    ) => Promise<PublicOfferingResponse | null>;

    const offering = await findOffering({
      where: {
        slug,
        status: "published",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        description: true,
        logo: true,
        videoUrl: true,
        website: true,
        offeringType: true,
        primaryFunction: true,
        subCategory: true,
        useCases: true,
        painPointsSolved: true,
        integrations: true,
        complianceFlags: true,
        learningCurve: true,
        implementationTime: true,
        icpTeamSize: true,
        icpIndustry: true,
        icpCompanyStage: true,
        icpBudget: true,
        pricingModel: true,
        startingPrice: true,
        hasFreeTrial: true,
        freeTrialDays: true,
        regions: true,
        averageRating: true,
        reviewCount: true,
        viewCount: true,
        status: true,
        featured: true,
        publishedAt: true,
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
            icon: true,
          },
        },
        features: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            order: true,
          },
          orderBy: [{ order: "asc" }, { name: "asc" }],
        },
        pricingPlans: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            billingCycle: true,
            currency: true,
            features: true,
            popular: true,
            order: true,
          },
          orderBy: [{ order: "asc" }, { price: "asc" }],
        },
        screenshots: {
          select: {
            id: true,
            url: true,
            title: true,
            order: true,
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
        partner: {
          select: {
            id: true,
            companyName: true,
            providerType: true,
            website: true,
            linkedInUrl: true,
            description: true,
            logo: true,
            industry: true,
            companySize: true,
            regions: true,
            complianceFlags: true,
            verifiedAt: true,
            approvedAt: true,
            publishedOfferings: true,
            totalViews: true,
            totalLeads: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { error: "Offering not found or not published" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...offering,
      externalRatings: await getExternalRatings(offering.id),
    });
  } catch (error) {
    console.error("Get offering error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch offering", message },
      { status: 500 }
    );
  }
}
