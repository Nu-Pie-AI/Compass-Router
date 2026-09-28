import { StarRating } from "../ui/StarRating";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title: string;
    content: string;
    pros?: string | null;
    cons?: string | null;
    userRole?: string | null;
    companySize?: string | null;
    createdAt: string | Date;
    user: { name?: string | null };
    helpfulCount: number;
    notHelpfulCount: number;
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="border-b border-[var(--border)] pb-6 last:border-0">
      {/* Rating & Date */}
      <div className="flex items-center justify-between mb-3">
        <StarRating rating={review.rating} reviewCount={0} size="sm" />
        <span className="text-xs text-[var(--muted-foreground)]">
          {formatDate(review.createdAt)}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[var(--foreground)] mb-2">
        {review.title}
      </h3>

      {/* Author Info */}
      <div className="text-sm text-[var(--muted-foreground)] mb-3">
        {review.user.name || "Anonymous"}
        {review.userRole && ` • ${review.userRole}`}
        {review.companySize && ` • ${review.companySize}`}
      </div>

      {/* Content */}
      <p className="text-[var(--muted-foreground)] mb-3 leading-relaxed">
        {review.content}
      </p>

      {/* Pros/Cons */}
      {(review.pros || review.cons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          {review.pros && (
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Pros</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {review.pros}
              </p>
            </div>
          )}
          {review.cons && (
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">Cons</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {review.cons}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Helpful Votes */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-[var(--muted-foreground)]">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border border-[var(--border)] rounded hover:bg-[var(--background)] transition-colors">
            👍 {review.helpfulCount}
          </button>
          <button className="px-3 py-1 border border-[var(--border)] rounded hover:bg-[var(--background)] transition-colors">
            👎 {review.notHelpfulCount}
          </button>
        </div>
      </div>
    </div>
  );
}
