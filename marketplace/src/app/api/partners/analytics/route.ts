import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type Period = "7d" | "30d" | "90d" | "all";

function getPeriodRange(period: Period) {
  if (period === "all") return { currentStart: undefined, previousStart: undefined };

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - days);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  return { currentStart, previousStart };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const periodParam = new URL(req.url).searchParams.get("period") as Period | null;
    const period: Period = ["7d", "30d", "90d", "all"].includes(periodParam || "")
      ? (periodParam as Period)
      : "30d";
    const { currentStart, previousStart } = getPeriodRange(period);

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
    }

    const offerings = await prisma.offering.findMany({
      where: { partnerId: partner.id },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        averageRating: true,
        reviewCount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const offeringIds = offerings.map((offering) => offering.id);

    if (offeringIds.length === 0) {
      return NextResponse.json({
        overview: {
          totalViews: 0,
          totalClicks: 0,
          totalLeads: 0,
          totalReviews: 0,
          averageRating: 0,
          clickThroughRate: 0,
          viewsChange: 0,
          clicksChange: 0,
          leadsChange: 0,
        },
        offeringStats: [],
        timeSeriesData: [],
        leadsByStatus: {},
      });
    }

    const dateFilter = currentStart ? { gte: currentStart } : undefined;
    const previousDateFilter =
      currentStart && previousStart ? { gte: previousStart, lt: currentStart } : undefined;

    const [
      views,
      clicks,
      leads,
      reviews,
      previousViews,
      previousClicks,
      previousLeads,
      clicksByOffering,
      clicksByType,
      viewsByOffering,
      leadsByOffering,
      leadsByStatusRows,
      reviewRows,
    ] = await Promise.all([
      prisma.offeringView.findMany({
        where: { offeringId: { in: offeringIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        select: { offeringId: true, createdAt: true },
      }),
      prisma.offeringClick.findMany({
        where: { offeringId: { in: offeringIds }, ...(dateFilter ? { clickedAt: dateFilter } : {}) },
        select: { offeringId: true, clickType: true, clickedAt: true },
      }),
      prisma.partnerContact.findMany({
        where: { partnerId: partner.id, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        select: { offeringId: true, status: true, createdAt: true },
      }),
      prisma.review.findMany({
        where: {
          offeringId: { in: offeringIds },
          status: "approved",
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { offeringId: true, rating: true },
      }),
      previousDateFilter
        ? prisma.offeringView.count({
            where: { offeringId: { in: offeringIds }, createdAt: previousDateFilter },
          })
        : Promise.resolve(0),
      previousDateFilter
        ? prisma.offeringClick.count({
            where: { offeringId: { in: offeringIds }, clickedAt: previousDateFilter },
          })
        : Promise.resolve(0),
      previousDateFilter
        ? prisma.partnerContact.count({
            where: { partnerId: partner.id, createdAt: previousDateFilter },
          })
        : Promise.resolve(0),
      prisma.offeringClick.groupBy({
        by: ["offeringId"],
        where: { offeringId: { in: offeringIds }, ...(dateFilter ? { clickedAt: dateFilter } : {}) },
        _count: { id: true },
      }),
      prisma.offeringClick.groupBy({
        by: ["offeringId", "clickType"],
        where: { offeringId: { in: offeringIds }, ...(dateFilter ? { clickedAt: dateFilter } : {}) },
        _count: { id: true },
      }),
      prisma.offeringView.groupBy({
        by: ["offeringId"],
        where: { offeringId: { in: offeringIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { id: true },
      }),
      prisma.partnerContact.groupBy({
        by: ["offeringId"],
        where: { partnerId: partner.id, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { id: true },
      }),
      prisma.partnerContact.groupBy({
        by: ["status"],
        where: { partnerId: partner.id, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by: ["offeringId"],
        where: {
          offeringId: { in: offeringIds },
          status: "approved",
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        _count: { id: true },
        _avg: { rating: true },
      }),
    ]);

    const timeSeries = new Map<string, { date: string; views: number; clicks: number; leads: number }>();
    for (const view of views) {
      const key = dayKey(view.createdAt);
      timeSeries.set(key, { date: key, views: (timeSeries.get(key)?.views || 0) + 1, clicks: timeSeries.get(key)?.clicks || 0, leads: timeSeries.get(key)?.leads || 0 });
    }
    for (const click of clicks) {
      const key = dayKey(click.clickedAt);
      timeSeries.set(key, { date: key, views: timeSeries.get(key)?.views || 0, clicks: (timeSeries.get(key)?.clicks || 0) + 1, leads: timeSeries.get(key)?.leads || 0 });
    }
    for (const lead of leads) {
      const key = dayKey(lead.createdAt);
      timeSeries.set(key, { date: key, views: timeSeries.get(key)?.views || 0, clicks: timeSeries.get(key)?.clicks || 0, leads: (timeSeries.get(key)?.leads || 0) + 1 });
    }

    const viewsMap = new Map(viewsByOffering.map((row) => [row.offeringId, row._count.id]));
    const clicksMap = new Map(clicksByOffering.map((row) => [row.offeringId, row._count.id]));
    const leadsMap = new Map(leadsByOffering.map((row) => [row.offeringId || "", row._count.id]));
    const reviewMap = new Map(reviewRows.map((row) => [row.offeringId || "", row]));

    const clickTypeMap = new Map<string, Record<string, number>>();
    for (const row of clicksByType) {
      const current = clickTypeMap.get(row.offeringId) || {};
      current[row.clickType || "unknown"] = row._count.id;
      clickTypeMap.set(row.offeringId, current);
    }

    const offeringStats = offerings.map((offering) => {
      const offeringViews = viewsMap.get(offering.id) || 0;
      const offeringClicks = clicksMap.get(offering.id) || 0;
      const offeringReviews = reviewMap.get(offering.id);
      return {
        ...offering,
        views: offeringViews,
        clicks: offeringClicks,
        leads: leadsMap.get(offering.id) || 0,
        ctr: offeringViews > 0 ? (offeringClicks / offeringViews) * 100 : 0,
        clickTypes: clickTypeMap.get(offering.id) || {},
        reviewCount: offeringReviews?._count.id || 0,
        averageRating: offeringReviews?._avg.rating || offering.averageRating || 0,
      };
    });

    const totalViews = views.length;
    const totalClicks = clicks.length;
    const totalLeads = leads.length;
    const ratingAverage =
      reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

    return NextResponse.json({
      overview: {
        totalViews,
        totalClicks,
        totalLeads,
        totalReviews: reviews.length,
        averageRating: ratingAverage,
        clickThroughRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
        viewsChange: percentChange(totalViews, previousViews),
        clicksChange: percentChange(totalClicks, previousClicks),
        leadsChange: percentChange(totalLeads, previousLeads),
      },
      offeringStats,
      timeSeriesData: Array.from(timeSeries.values()).sort((a, b) => a.date.localeCompare(b.date)),
      leadsByStatus: leadsByStatusRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Partner analytics error:", error);
    return NextResponse.json({ error: "Failed to load partner analytics" }, { status: 500 });
  }
}
