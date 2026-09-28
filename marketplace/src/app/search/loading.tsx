import { SkeletonCard } from "@/components/ui/SkeletonCard";

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-[var(--background)] rounded w-48 mb-4 animate-pulse" />
          <div className="max-w-2xl">
            <div className="h-12 bg-[var(--background)] rounded animate-pulse" />
          </div>
        </div>

        {/* Results Count Skeleton */}
        <div className="h-5 bg-[var(--background)] rounded w-64 mb-6 animate-pulse" />

        {/* Results Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
