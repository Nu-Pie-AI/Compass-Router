import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type Period = "7d" | "30d" | "90d" | "all";

function getStartDate(period: Period) {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodParam = new URL(req.url).searchParams.get("period") as Period | null;
    const period: Period = ["7d", "30d", "90d", "all"].includes(periodParam || "")
      ? (periodParam as Period)
      : "30d";
    const start = getStartDate(period);

    const [
      totalViews,
      totalClicks,
      totalLeads,
      pendingReviews,
      approvedReviews,
      topOfferings,
      topPartners,
      categoryRows,
      externalRatingRows,
      externalRequestRows,
    ] = await Promise.all([
      prisma.offeringView.count({ where: start ? { createdAt: { gte: start } } : {} }),
      prisma.offeringClick.count({ where: start ? { clickedAt: { gte: start } } : {} }),
      prisma.partnerContact.count({ where: start ? { createdAt: { gte: start } } : {} }),
      prisma.review.count({ where: { status: "pending" } }),
      prisma.review.count({ where: { status: "approved", ...(start ? { createdAt: { gte: start } } : {}) } }),
      prisma.offering.findMany({
        where: { status: "published" },
        select: {
          id: true,
          slug: true,
          title: true,
          viewCount: true,
          averageRating: true,
          reviewCount: true,
          partner: { select: { companyName: true } },
          _count: { select: { offeringClicks: true, contacts: true } },
        },
        orderBy: [{ viewCount: "desc" }, { reviewCount: "desc" }],
        take: 10,
      }),
      prisma.partner.findMany({
        select: {
          id: true,
          companyName: true,
          publishedOfferings: true,
          totalLeads: true,
          offerings: {
            select: { viewCount: true },
          },
        },
        orderBy: [{ totalLeads: "desc" }, { publishedOfferings: "desc" }],
        take: 10,
      }),
      prisma.category.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          _count: {
            select: {
              offerings: { where: { status: "published" } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.externalRating.groupBy({
        by: ["source"],
        _count: { id: true },
        _avg: { rating: true },
      }),
      prisma.externalRecommendation.groupBy({
        by: ["category"],
        _count: { id: true },
        _sum: { clickCount: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ]);

    const topPartnersWithViews = topPartners.map((partner) => ({
      id: partner.id,
      companyName: partner.companyName,
      publishedOfferings: partner.publishedOfferings,
      totalLeads: partner.totalLeads,
      totalViews: partner.offerings.reduce((sum, offering) => sum + offering.viewCount, 0),
    }));

    return NextResponse.json({
      overview: {
        totalViews,
        totalClicks,
        totalLeads,
        clickThroughRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
        pendingReviews,
        approvedReviews,
      },
      topOfferings: topOfferings.map((offering) => ({
        id: offering.id,
        slug: offering.slug,
        title: offering.title,
        partnerName: offering.partner?.companyName,
        views: offering.viewCount,
        clicks: offering._count.offeringClicks,
        leads: offering._count.contacts,
        averageRating: offering.averageRating,
        reviewCount: offering.reviewCount,
      })),
      topPartners: topPartnersWithViews,
      categories: categoryRows.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        offeringCount: category._count.offerings,
      })),
      externalRatings: externalRatingRows.map((row) => ({
        source: row.source,
        count: row._count.id,
        averageRating: row._avg.rating || 0,
      })),
      externalDemand: externalRequestRows.map((row) => ({
        category: row.category,
        requests: row._count.id,
        clicks: row._sum.clickCount || 0,
      })),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json({ error: "Failed to load admin analytics" }, { status: 500 });
  }
}
