import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  productListParamsSchema,
  buildProductWhereClause,
  buildProductOrderBy,
  validatePagination,
  calculatePagination,
  createErrorResponse,
  createSuccessResponse,
  productListSelect,
} from "@/lib/api/products";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawParams = Object.fromEntries(searchParams.entries());

    const params = productListParamsSchema.parse(rawParams);

    const { page, limit, skip, take } = validatePagination(
      params.page,
      params.limit
    );

    const where = buildProductWhereClause(params);

    const orderBy = buildProductOrderBy(params.sort);

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: productListSelect,
        orderBy,
        skip,
        take,
      }),
    ]);

    const meta = calculatePagination(page, limit, totalItems);

    return createSuccessResponse(products, meta);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid query parameters", 400);
    }

    console.error("Error fetching products:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
