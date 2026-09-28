import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notifyAdmin } from "@/lib/email";

export const runtime = "nodejs";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(5).max(100),
  content: z.string().min(50).max(2000),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  userRole: z.enum(["Administrator", "Manager", "End User"]).optional(),
  companySize: z.string().optional(),
  industry: z.string().optional(),
  usageDuration: z.string().optional(),
});

// GET handler - fetch reviews for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const sort = searchParams.get("sort") || "recent";

    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const where = {
      productId: product.id,
      status: "approved", // Only show approved reviews
    };

    const orderBy =
      sort === "helpful"
        ? [{ helpfulCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return NextResponse.json({
      data: reviews,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST handler - submit a new review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const body = await request.json();

    const validated = reviewSchema.parse(body);

    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if user already reviewed this product
    const existing = await prisma.review.findFirst({
      where: {
        productId: product.id,
        userId: session.user.id,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this product" },
        { status: 400 }
      );
    }

    const review = await prisma.review.create({
      data: {
        ...validated,
        productId: product.id,
        userId: session.user.id,
        status: "pending", // Requires moderation
      },
    });

    await notifyAdmin(
      "Product review pending moderation",
      `A new review for product ${slug} is waiting for moderation.`,
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/reviews`
    );

    return NextResponse.json(
      {
        data: review,
        message: "Review submitted successfully and is pending moderation",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
