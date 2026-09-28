import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  createErrorResponse,
  createSuccessResponse,
  productListSelect,
} from "@/lib/api/products";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "10"));

    const products = await prisma.product.findMany({
      where: {
        status: "published",
      },
      select: productListSelect,
      orderBy: {
        reviewCount: "desc",
      },
      take: limit,
    });

    return createSuccessResponse(products);
  } catch (error) {
    console.error("Error fetching trending products:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
