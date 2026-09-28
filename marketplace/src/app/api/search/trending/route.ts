import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    // Get trending searches from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trending = await prisma.searchAnalytics.groupBy({
      by: ["query"],
      where: {
        createdAt: { gte: sevenDaysAgo },
        resultsCount: { gt: 0 }, // Only include searches with results
      },
      _count: { query: true },
      orderBy: { _count: { query: "desc" } },
      take: limit,
    });

    const trendingQueries = trending.map((t) => ({
      query: t.query,
      count: t._count.query,
    }));

    return NextResponse.json(
      {
        data: trendingQueries,
        meta: { count: trendingQueries.length },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Trending search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending searches" },
      { status: 500 }
    );
  }
}
