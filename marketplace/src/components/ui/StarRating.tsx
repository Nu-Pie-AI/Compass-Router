import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  reviewCount: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}

export function StarRating({
  rating,
  reviewCount,
  size = "md",
  showCount = true,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // Generate array of 5 stars
  const stars = Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    const isFilled = starValue <= Math.floor(rating);
    const isHalf = starValue === Math.ceil(rating) && rating % 1 >= 0.5;

    return (
      <div key={index} className="relative">
        <Star
          className={`${sizeClasses[size]} ${
            isFilled || isHalf
              ? "fill-[var(--secondary)] text-[var(--secondary)]"
              : "text-[var(--border)]"
          }`}
        />
        {isHalf && (
          <div className="absolute top-0 left-0 overflow-hidden" style={{ width: "50%" }}>
            <Star
              className={`${sizeClasses[size]} fill-[var(--secondary)] text-[var(--secondary)]`}
            />
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`Rated ${rating.toFixed(1)} out of 5 stars`}
      >
        {stars}
      </div>
      <span className={`${textSizes[size]} font-medium text-[var(--foreground)]`}>
        {rating.toFixed(1)}
      </span>
      {showCount && reviewCount > 0 && (
        <span className={`${textSizes[size]} text-[var(--muted-foreground)]`}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
