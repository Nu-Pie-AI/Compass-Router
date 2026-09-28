import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  recalculateOfferingReviewMetrics,
  recalculateProductReviewMetrics,
} from "@/lib/review-metrics";
import { sendRejectionEmail } from "@/lib/email";

export const runtime = "nodejs";

const rejectSchema = z.object({
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = rejectSchema.parse(await req.json().catch(() => ({})));

    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: "rejected",
          moderatedAt: new Date(),
          moderatedBy: session.user.id,
          moderationReason: body.reason || null,
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      });

      if (updated.offeringId) {
        await recalculateOfferingReviewMetrics(tx, updated.offeringId);
      }
      if (updated.productId) {
        await recalculateProductReviewMetrics(tx, updated.productId);
      }

      return updated;
    });

    await sendRejectionEmail(
      review.user.email,
      "Review",
      body.reason || "Your review did not meet the marketplace moderation guidelines.",
      review.user.name
    );

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    console.error("Review reject error:", error);
    return NextResponse.json({ error: "Failed to reject review" }, { status: 500 });
  }
}
