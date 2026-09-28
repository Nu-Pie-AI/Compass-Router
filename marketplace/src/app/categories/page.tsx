import { CategoryCard } from "@/components/ui/CategoryCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";

// Force dynamic rendering - don't try to build this at build time
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  // Fetch directly from DB instead of API
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          offerings: {
            where: { status: "published" },
          },
        },
      },
    },
    orderBy: [
      { featured: "desc" },
      { order: "asc" },
      { name: "asc" },
    ],
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-3">
            Browse by Category
          </h1>
          <p className="text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Find solutions organized by use case. Explore {categories.length} categories
            with curated solution collections.
          </p>
        </div>

        {/* Category Grid */}
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category: any) => (
              <CategoryCard
                key={category.id}
                slug={category.slug}
                name={category.name}
                // icon={category.icon}
                icon={category.icon ?? undefined}
                productCount={category._count.offerings}
                // description={category.description}
                description={category.description ?? undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-[var(--muted-foreground)]">
              No categories available yet.
            </p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-3">
            Can't find what you're looking for?
          </h2>
          <p className="text-[var(--muted-foreground)] mb-6">
            Browse all solutions or use our search to find the perfect fit for your needs.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/browse"
              className="px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors"
            >
              Browse All Solutions
            </Link>
            <Link
              href="/browse"
              className="px-6 py-3 border border-[var(--border)] hover:bg-[var(--background)] text-[var(--foreground)] rounded-lg font-medium transition-colors"
            >
              Search Solutions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
