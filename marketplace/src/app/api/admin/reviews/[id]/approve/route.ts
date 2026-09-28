import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  recalculateOfferingReviewMetrics,
  recalculateProductReviewMetrics,
} from "@/lib/review-metrics";
import { sendApprovalEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: "approved",
          moderatedAt: new Date(),
          moderatedBy: session.user.id,
          moderationReason: null,
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

    await sendApprovalEmail(review.user.email, "Review", review.user.name);

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error("Review approve error:", error);
    return NextResponse.json({ error: "Failed to approve review" }, { status: 500 });
  }
}
