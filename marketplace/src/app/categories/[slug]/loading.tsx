import { SkeletonCard } from "@/components/ui/SkeletonCard";

export default function CategoryDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb Skeleton */}
        <div className="h-4 bg-[var(--background)] rounded w-64 mb-6 animate-pulse" />

        {/* Back Link Skeleton */}
        <div className="h-4 bg-[var(--background)] rounded w-32 mb-8 animate-pulse" />

        {/* Category Header Skeleton */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 mb-8 animate-pulse">
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 bg-[var(--background)] rounded" />
            <div className="flex-1">
              <div className="h-8 bg-[var(--background)] rounded w-64 mb-2" />
              <div className="h-5 bg-[var(--background)] rounded w-96 mb-4" />
              <div className="h-4 bg-[var(--background)] rounded w-32" />
            </div>
          </div>
        </div>

        {/* Sort Controls Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 bg-[var(--background)] rounded w-32 animate-pulse" />
          <div className="h-10 bg-[var(--background)] rounded w-40 animate-pulse" />
        </div>

        {/* Products Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
