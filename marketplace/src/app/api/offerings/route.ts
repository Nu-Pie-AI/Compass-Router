import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const offeringListParamsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(12),
  category: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  pricingModel: z.string().optional(),
  sort: z.enum(["popular", "newest", "rating", "price-asc", "price-desc", "name"]).default("popular"),
  search: z.string().optional(),
  featured: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());

    const params = offeringListParamsSchema.parse(rawParams);

    const page = params.page || 1;
    const limit = params.limit || 12;
    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause
    const where: any = {
      status: "published", // Only show published offerings
    };

    // Category filter
    if (params.category) {
      where.categories = {
        some: {
          slug: params.category,
        },
      };
    }

    // Rating filter
    if (params.minRating) {
      where.averageRating = {
        gte: params.minRating,
      };
    }

    // Pricing model filter
    if (params.pricingModel) {
      where.pricingModel = params.pricingModel;
    }

    // Search filter
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { shortDescription: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Featured filter
    if (params.featured !== undefined) {
      where.featured = params.featured;
    }

    // Build orderBy
    let orderBy: any = {};
    switch (params.sort) {
      case "popular":
        orderBy = { viewCount: "desc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "rating":
        orderBy = { averageRating: "desc" };
        break;
      case "price-asc":
        orderBy = { startingPrice: "asc" };
        break;
      case "price-desc":
        orderBy = { startingPrice: "desc" };
        break;
      case "name":
        orderBy = { title: "asc" };
        break;
      default:
        orderBy = { viewCount: "desc" };
    }

    const [totalItems, offerings] = await Promise.all([
      prisma.offering.count({ where }),
      prisma.offering.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          logo: true,
          averageRating: true,
          reviewCount: true,
          pricingModel: true,
          startingPrice: true,
          featured: true,
          offeringType: true,
          primaryFunction: true,
          categories: {
            select: {
              id: true,
              slug: true,
              name: true,
              icon: true,
            },
          },
          partner: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const meta = {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return NextResponse.json({
      success: true,
      data: offerings,
      meta,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error fetching offerings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
