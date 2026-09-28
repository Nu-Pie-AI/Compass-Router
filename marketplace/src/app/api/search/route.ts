import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchOfferings, trackSearch } from "@/lib/search/engine";

export const runtime = "nodejs";

const searchRequestSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(20).optional().default(20),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const params = searchRequestSchema.parse(body);

    if (!params.query.trim()) {
      return NextResponse.json({ error: "Query cannot be empty" }, { status: 400 });
    }

    const { results, count } = await searchOfferings(params.query, params.limit);

    const userId = undefined;
    const sessionId = req.headers.get("x-session-id") || undefined;

    trackSearch(params.query, count, userId, sessionId);

    return NextResponse.json(
      {
        data: results.map((r: any) => ({
          offering: {
            id: r.id,
            title: r.title,
            slug: r.slug,
            logo: r.logo,
            shortDescription: r.shortDescription,
            averageRating: r.averageRating,
            reviewCount: r.reviewCount,
            pricingModel: r.pricingModel,
            startingPrice: r.startingPrice,
            categories: r.categories,
            featured: r.featured,
            offeringType: r.offeringType,
          },
          relevance: r.relevanceScore,
        })),
        meta: {
          count,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Search error:", error);

    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
