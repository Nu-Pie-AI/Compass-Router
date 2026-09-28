import { NextResponse } from "next/server";
import { z } from "zod";

export interface ProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  minRating?: number;
  sort?: "rating" | "newest" | "popular" | "name";
  search?: string;
  featured?: boolean;
  status?: string;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const productListParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "1")),
  limit: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "12")),
  category: z.string().optional(),
  minRating: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  sort: z
    .enum(["rating", "newest", "popular", "name"])
    .optional()
    .default("popular"),
  search: z.string().optional(),
  featured: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  status: z.string().optional().default("published"),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export const productListSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  logo: true,
  averageRating: true,
  reviewCount: true,
  pricingModel: true,
  startingPrice: true,
  featured: true,
  categories: {
    select: {
      slug: true,
      name: true,
    },
  },
};

export const productDetailSelect = {
  ...productListSelect,
  description: true,
  videoUrl: true,
  website: true,
  companyName: true,
  companySize: true,
  founded: true,
  headquarters: true,
  hasFreeTrial: true,
  freeTrialDays: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  features: {
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
    },
    orderBy: { order: "asc" as const },
  },
  pricingPlans: {
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      billingCycle: true,
      currency: true,
      features: true,
      popular: true,
    },
    orderBy: { order: "asc" as const },
  },
  screenshots: {
    select: {
      id: true,
      url: true,
      title: true,
    },
    orderBy: { order: "asc" as const },
  },
  vendor: {
    select: {
      id: true,
      companyName: true,
    },
  },
};

export const categoryListSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  icon: true,
  productCount: true,
  featured: true,
};

export function buildProductWhereClause(params: ProductListParams) {
  const where: any = {
    status: params.status || "published",
  };

  if (params.category) {
    where.categories = {
      some: {
        slug: params.category,
      },
    };
  }

  if (params.minRating !== undefined) {
    where.averageRating = {
      gte: params.minRating,
    };
  }

  if (params.featured === true) {
    where.featured = true;
  }
  // If featured is false or undefined, don't filter (show all products)

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export function buildProductOrderBy(sort: string = "popular") {
  switch (sort) {
    case "rating":
      return { averageRating: "desc" as const };
    case "newest":
      return { createdAt: "desc" as const };
    case "name":
      return { name: "asc" as const };
    case "popular":
    default:
      return { reviewCount: "desc" as const };
  }
}

export function calculatePagination(
  page: number,
  limit: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function validatePagination(page?: number, limit?: number) {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.max(1, Math.min(50, limit || 12));

  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit,
    take: validatedLimit,
  };
}

export function createErrorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function createSuccessResponse<T>(data: T, meta?: PaginationMeta) {
  return NextResponse.json(
    { data, ...(meta && { meta }) },
    { status: 200 }
  );
}
