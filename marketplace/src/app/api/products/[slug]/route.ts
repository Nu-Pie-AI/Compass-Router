import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  slugParamSchema,
  createErrorResponse,
  createSuccessResponse,
  productDetailSelect,
} from "@/lib/api/products";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = slugParamSchema.parse(await params);

    const product = await prisma.product.findUnique({
      where: {
        slug,
        status: "published",
      },
      select: productDetailSelect,
    });

    if (!product) {
      return createErrorResponse("Product not found", 404);
    }

    prisma.product
      .update({
        where: { slug },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.error("Failed to increment view count:", err));

    return createSuccessResponse(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid product slug", 400);
    }

    console.error("Error fetching product:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
