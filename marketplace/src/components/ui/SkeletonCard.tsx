export function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
      {/* Logo */}
      <div className="w-16 h-16 bg-[var(--background)] rounded-lg mb-4" />

      {/* Title */}
      <div className="h-5 bg-[var(--background)] rounded mb-3 w-3/4" />

      {/* Description */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-[var(--background)] rounded w-full" />
        <div className="h-4 bg-[var(--background)] rounded w-5/6" />
      </div>

      {/* Rating */}
      <div className="h-4 bg-[var(--background)] rounded w-1/2 mb-4" />

      {/* Badge */}
      <div className="h-6 bg-[var(--background)] rounded w-1/3 mb-4" />

      {/* Tags */}
      <div className="flex gap-2">
        <div className="h-6 bg-[var(--background)] rounded w-16" />
        <div className="h-6 bg-[var(--background)] rounded w-20" />
      </div>
    </div>
  );
}
