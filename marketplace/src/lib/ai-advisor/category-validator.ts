import prisma from '@/lib/prisma';
import { mapCategoryToSlug, getCategorySuggestions } from './category-mapper';

export interface CategoryValidationResult {
  isValid: boolean;
  slug: string | null;
  name: string | null;
  confidence: 'exact' | 'mapped' | 'fuzzy' | 'none';
  offeringsCount: number;
  suggestions?: string[];
}

/**
 * Validates and normalizes a detected category against the database
 *
 * Process:
 * 1. Try category mapper (deterministic aliases)
 * 2. Try exact slug match in database
 * 3. Try fuzzy match (contains in slug or name)
 * 4. Return null if no match (triggers external recommendations)
 *
 * @param detectedCategory - Category detected by AI
 * @returns Validated category with metadata, or null if no match
 */
export async function validateAndNormalizeCategory(
  detectedCategory: string
): Promise<CategoryValidationResult> {
  const normalizedInput = detectedCategory.toLowerCase().trim();

  console.log(`[Category Validator] Input: "${detectedCategory}"`);

  // 1. Try category mapper (deterministic aliases)
  const mappedSlug = mapCategoryToSlug(detectedCategory);
  if (mappedSlug) {
    console.log(`[Category Validator] Mapped to: "${mappedSlug}"`);

    const mappedCategory = await prisma.category.findUnique({
      where: { slug: mappedSlug },
      include: {
        _count: {
          select: {
            offerings: { where: { status: 'published' } },
          },
        },
      },
    });

    if (mappedCategory) {
      return {
        isValid: true,
        slug: mappedCategory.slug,
        name: mappedCategory.name,
        confidence: 'mapped',
        offeringsCount: mappedCategory._count.offerings,
      };
    }
  }

  // 2. Try exact slug match
  const exactMatch = await prisma.category.findUnique({
    where: { slug: normalizedInput },
    include: {
      _count: {
        select: {
          offerings: { where: { status: 'published' } },
        },
      },
    },
  });

  if (exactMatch) {
    console.log(`[Category Validator] Exact match: "${exactMatch.slug}"`);
    return {
      isValid: true,
      slug: exactMatch.slug,
      name: exactMatch.name,
      confidence: 'exact',
      offeringsCount: exactMatch._count.offerings,
    };
  }

  // 3. Try fuzzy match (contains in either direction)
  const fuzzyMatches = await prisma.category.findMany({
    where: {
      OR: [
        { slug: { contains: normalizedInput, mode: 'insensitive' } },
        { name: { contains: normalizedInput, mode: 'insensitive' } },
      ],
    },
    include: {
      _count: {
        select: {
          offerings: { where: { status: 'published' } },
        },
      },
    },
  });

  // Sort by offerings count descending and take best match
  const bestMatch = fuzzyMatches
    .filter((cat) => cat._count.offerings > 0)
    .sort((a, b) => b._count.offerings - a._count.offerings)[0];

  if (bestMatch) {
    console.log(`[Category Validator] Fuzzy match: "${bestMatch.slug}"`);
    return {
      isValid: true,
      slug: bestMatch.slug,
      name: bestMatch.name,
      confidence: 'fuzzy',
      offeringsCount: bestMatch._count.offerings,
    };
  }

  // 4. No match found - return null with suggestions
  // This will trigger external recommendations instead of forcing a bad match
  const suggestions = getCategorySuggestions(detectedCategory);

  console.log(`[Category Validator] No match found. Suggestions: ${suggestions.join(', ')}`);

  return {
    isValid: false,
    slug: null,
    name: null,
    confidence: 'none',
    offeringsCount: 0,
    suggestions,
  };
}
