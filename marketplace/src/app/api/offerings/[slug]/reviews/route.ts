import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyAdmin } from "@/lib/email";

export const runtime = "nodejs";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(5).max(100),
  content: z.string().trim().min(50).max(2000),
  pros: z.string().trim().max(500).optional().or(z.literal("")),
  cons: z.string().trim().max(500).optional().or(z.literal("")),
  userRole: z.string().trim().max(80).optional().or(z.literal("")),
  companySize: z.string().trim().max(80).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  usageDuration: z.string().trim().max(80).optional().or(z.literal("")),
});

function getOrderBy(sort: string) {
  if (sort === "helpful") {
    return [{ helpfulCount: "desc" as const }, { createdAt: "desc" as const }];
  }
  if (sort === "highest") {
    return [{ rating: "desc" as const }, { createdAt: "desc" as const }];
  }
  if (sort === "lowest") {
    return [{ rating: "asc" as const }, { createdAt: "desc" as const }];
  }
  return [{ createdAt: "desc" as const }];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 50);
    const sort = searchParams.get("sort") || "recent";
    const rating = searchParams.get("rating");

    const offering = await prisma.offering.findFirst({
      where: { slug, status: "published" },
      select: { id: true, averageRating: true, reviewCount: true },
    });

    if (!offering) {
      return NextResponse.json({ error: "Offering not found" }, { status: 404 });
    }

    const where = {
      offeringId: offering.id,
      status: "approved",
      ...(rating ? { rating: Number(rating) } : {}),
    };

    const [reviews, total, distributionRows] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          pros: true,
          cons: true,
          userRole: true,
          companySize: true,
          industry: true,
          usageDuration: true,
          helpfulCount: true,
          notHelpfulCount: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: getOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({
        by: ["rating"],
        where: {
          offeringId: offering.id,
          status: "approved",
        },
        _count: { rating: true },
      }),
    ]);

    const distribution = [1, 2, 3, 4, 5].reduce<Record<number, number>>((acc, star) => {
      acc[star] = distributionRows.find((row) => row.rating === star)?._count.rating || 0;
      return acc;
    }, {});

    return NextResponse.json({
      data: reviews,
      summary: {
        averageRating: offering.averageRating,
        reviewCount: offering.reviewCount,
        distribution,
      },
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Offering reviews fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch offering reviews" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await req.json();
    const data = reviewSchema.parse(body);

    const offering = await prisma.offering.findFirst({
      where: { slug, status: "published" },
      select: { id: true },
    });

    if (!offering) {
      return NextResponse.json({ error: "Offering not found" }, { status: 404 });
    }

    const existing = await prisma.review.findFirst({
      where: {
        offeringId: offering.id,
        userId: session.user.id,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this offering" },
        { status: 400 }
      );
    }

    const review = await prisma.review.create({
      data: {
        rating: data.rating,
        title: data.title,
        content: data.content,
        pros: data.pros || null,
        cons: data.cons || null,
        userRole: data.userRole || null,
        companySize: data.companySize || null,
        industry: data.industry || null,
        usageDuration: data.usageDuration || null,
        offeringId: offering.id,
        userId: session.user.id,
        status: "pending",
      },
    });

    await notifyAdmin(
      "Offering review pending moderation",
      `A new review for offering ${slug} is waiting for moderation.`,
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/reviews`
    );

    return NextResponse.json(
      {
        data: review,
        message: "Review submitted successfully and is pending moderation.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Offering review submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit offering review" },
      { status: 500 }
    );
  }
}
