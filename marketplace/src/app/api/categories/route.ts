import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  createErrorResponse,
  createSuccessResponse,
  categoryListSelect,
} from "@/lib/api/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // This route handles query parameters
export const revalidate = 86400; // Cache for 24 hours (categories rarely change)

export async function GET(req: NextRequest) {
  try {
    const featured = req.nextUrl.searchParams.get("featured") === "true";

    const where = featured ? { featured: true } : {};

    const categories = await prisma.category.findMany({
      where,
      select: {
        ...categoryListSelect,
        _count: {
          select: {
            offerings: {
              where: { status: "published" },
            },
          },
        },
      },
      orderBy: [
        { featured: "desc" },
        { order: "asc" },
        { name: "asc" },
      ],
    });

    // Map to replace denormalized productCount with real aggregated count (keeping field name for compatibility)
    const categoriesWithRealCounts = categories.map((cat: any) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      productCount: cat._count.offerings, // Count offerings but keep field name for compatibility
      featured: cat.featured,
    }));

    const response = createSuccessResponse(categoriesWithRealCounts);

    // Add Cache-Control headers for CDN and browser caching
    response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

    return response;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
