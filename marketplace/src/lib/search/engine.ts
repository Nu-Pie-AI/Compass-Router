import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  logo: string | null;
  averageRating: number;
  reviewCount: number;
  relevanceScore: number;
}

export function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[^\w\s\-"']/g, "").slice(0, 100);
}

export async function searchOfferings(
  query: string,
  limit: number = 20
): Promise<{ results: SearchResult[]; count: number }> {
  const sanitizedQuery = sanitizeSearchQuery(query);

  if (!sanitizedQuery) {
    return { results: [], count: 0 };
  }

  const effectiveLimit = Math.min(limit, 20);

  const sql = Prisma.sql`
  SELECT
    id,
    title,
    slug,
    logo,
    "averageRating",
    "reviewCount",
    ts_rank(search_vector, websearch_to_tsquery('english', ${sanitizedQuery})) as "relevanceScore"
  FROM offerings
  WHERE
    search_vector @@ websearch_to_tsquery('english', ${sanitizedQuery})
    AND status = 'published'
  ORDER BY "relevanceScore" DESC, "averageRating" DESC
  LIMIT ${effectiveLimit}
`;


  const countSql = Prisma.sql`
    SELECT COUNT(*) as count
    FROM offerings
    WHERE
      search_vector @@ websearch_to_tsquery('english', ${sanitizedQuery})
      AND status = 'published'
  `;

  const [results, countResult] = await Promise.all([
    prisma.$queryRaw<SearchResult[]>(sql),
    prisma.$queryRaw<[{ count: bigint }]>(countSql),
  ]);

  const count = Number(countResult[0].count);

  return { results, count };
}

export async function trackSearch(
  query: string,
  resultsCount: number,
  userId?: string,
  sessionId?: string
): Promise<void> {
  prisma.searchAnalytics
    .create({
      data: {
        query,
        resultsCount,
        userId,
        sessionId,
      },
    })
    .catch((err) => console.error("Failed to track search:", err));
}
