import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  slugParamSchema,
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = slugParamSchema.parse(await params);

    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        icon: true
      },
    });

    if (!category) {
      return createErrorResponse("Category not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const rawParams = {
      ...Object.fromEntries(searchParams.entries()),
      category: slug,
    };

    const validatedParams = productListParamsSchema.parse(rawParams);

    const { page, limit, skip, take } = validatePagination(
      validatedParams.page,
      validatedParams.limit
    );

    const where = buildProductWhereClause(validatedParams);

    const orderBy = buildProductOrderBy(validatedParams.sort);

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

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        icon: category.icon
      },
      data: products,
      meta
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid parameters", 400);
    }

    console.error("Error fetching products by category:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
