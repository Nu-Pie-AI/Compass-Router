import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const voteSchema = z.object({
  helpful: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const { helpful } = voteSchema.parse(await req.json());

    const review = await prisma.review.findFirst({
      where: { id, status: "approved" },
      select: { id: true },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.reviewVote.create({
        data: {
          reviewId: id,
          userId: session.user.id,
          helpful,
        },
      });

      return tx.review.update({
        where: { id },
        data: {
          [helpful ? "helpfulCount" : "notHelpfulCount"]: { increment: 1 },
        },
        select: {
          id: true,
          helpfulCount: true,
          notHelpfulCount: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You have already voted on this review" }, { status: 400 });
    }

    console.error("Review vote error:", error);
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}
