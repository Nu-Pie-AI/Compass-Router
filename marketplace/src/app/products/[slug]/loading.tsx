export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Link Skeleton */}
        <div className="h-4 bg-[var(--background)] rounded w-32 mb-6 animate-pulse" />

        {/* Product Header Skeleton */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 mb-6 animate-pulse">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-24 h-24 bg-[var(--background)] rounded-lg flex-shrink-0" />
            <div className="flex-1 w-full">
              <div className="h-8 bg-[var(--background)] rounded w-3/4 mb-3" />
              <div className="h-5 bg-[var(--background)] rounded w-1/2 mb-3" />
              <div className="h-4 bg-[var(--background)] rounded w-1/4 mb-4" />
              <div className="flex gap-2 mb-4">
                <div className="h-6 bg-[var(--background)] rounded w-20" />
                <div className="h-6 bg-[var(--background)] rounded w-24" />
              </div>
              <div className="h-6 bg-[var(--background)] rounded w-32 mb-6" />
              <div className="flex gap-3">
                <div className="h-11 bg-[var(--background)] rounded w-32" />
                <div className="h-11 bg-[var(--background)] rounded w-32" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Skeleton */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="aspect-video bg-[var(--background)] rounded-lg animate-pulse" />
            </div>

            {/* About Skeleton */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
              <div className="h-7 bg-[var(--background)] rounded w-48 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[var(--background)] rounded" />
                ))}
              </div>
            </div>

            {/* Features Skeleton */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
              <div className="h-7 bg-[var(--background)] rounded w-32 mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-5 h-5 bg-[var(--background)] rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[var(--background)] rounded w-3/4" />
                      <div className="h-3 bg-[var(--background)] rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-[var(--background)] rounded w-24 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-4 bg-[var(--background)] rounded w-20 mb-1" />
                    <div className="h-3 bg-[var(--background)] rounded w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
