import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const slugParamSchema = z.object({
  slug: z.string(),
});

const sortSchema = z.enum(["popular", "newest", "rating", "price-low", "price-high"]).optional();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = slugParamSchema.parse(await params);

    // Fetch category
    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        icon: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Get sort parameter
    const { searchParams } = new URL(req.url);
    const sort = sortSchema.parse(searchParams.get("sort") || "popular");

    // Build order by clause
    let orderBy: any = { averageRating: "desc" };
    switch (sort) {
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "rating":
        orderBy = { averageRating: "desc" };
        break;
      case "price-low":
        orderBy = { startingPrice: "asc" };
        break;
      case "price-high":
        orderBy = { startingPrice: "desc" };
        break;
      case "popular":
      default:
        orderBy = { averageRating: "desc" };
        break;
    }

    // Fetch offerings in this category
    const offerings = await prisma.offering.findMany({
      where: {
        status: "published",
        categories: {
          some: {
            id: category.id,
          },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        logo: true,
        shortDescription: true,
        averageRating: true,
        reviewCount: true,
        pricingModel: true,
        startingPrice: true,
        offeringType: true,
        featured: true,
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy,
    });

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        icon: category.icon,
      },
      data: offerings,
      meta: {
        total: offerings.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error fetching offerings by category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
