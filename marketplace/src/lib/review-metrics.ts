import type { PrismaClient } from "@prisma/client";

type ReviewMetricsDb = Pick<PrismaClient, "review" | "offering" | "product">;

export async function recalculateOfferingReviewMetrics(
  prisma: ReviewMetricsDb,
  offeringId: string
) {
  const [aggregate, count] = await Promise.all([
    prisma.review.aggregate({
      where: { offeringId, status: "approved" },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { offeringId, status: "approved" } }),
  ]);

  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      averageRating: aggregate._avg.rating || 0,
      reviewCount: count,
    },
  });
}

export async function recalculateProductReviewMetrics(
  prisma: ReviewMetricsDb,
  productId: string
) {
  const [aggregate, count] = await Promise.all([
    prisma.review.aggregate({
      where: { productId, status: "approved" },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { productId, status: "approved" } }),
  ]);

  await prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: aggregate._avg.rating || 0,
      reviewCount: count,
    },
  });
}
