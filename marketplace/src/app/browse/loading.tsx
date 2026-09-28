import { SkeletonCard } from "@/components/ui/SkeletonCard";

export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-10 bg-[var(--background)] rounded w-64 mb-3 animate-pulse" />
          <div className="h-6 bg-[var(--background)] rounded w-96 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar Skeleton */}
          <aside className="lg:col-span-1">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-[var(--background)] rounded w-24 mb-6" />
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[var(--background)] rounded w-full" />
                ))}
              </div>
            </div>
          </aside>

          {/* Product Grid Skeleton */}
          <main className="lg:col-span-3">
            <div className="h-5 bg-[var(--background)] rounded w-48 mb-6 animate-pulse" />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
