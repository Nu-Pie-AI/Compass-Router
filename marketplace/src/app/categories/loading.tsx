export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Header Skeleton */}
        <div className="mb-12 text-center">
          <div className="h-10 bg-[var(--background)] rounded w-96 mx-auto mb-3 animate-pulse" />
          <div className="h-6 bg-[var(--background)] rounded w-[500px] mx-auto animate-pulse" />
        </div>

        {/* Category Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse"
            >
              <div className="w-12 h-12 bg-[var(--background)] rounded mb-4" />
              <div className="h-6 bg-[var(--background)] rounded w-3/4 mb-2" />
              <div className="h-4 bg-[var(--background)] rounded w-1/2 mb-2" />
              <div className="h-4 bg-[var(--background)] rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
