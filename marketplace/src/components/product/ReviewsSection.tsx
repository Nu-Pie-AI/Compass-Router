"use client";

import { useState, useEffect } from "react";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";
import { StarRating } from "../ui/StarRating";
import { useSession } from "next-auth/react";

interface ReviewsSectionProps {
  productSlug: string;
  averageRating: number;
  reviewCount: number;
}

export function ReviewsSection({
  productSlug,
  averageRating,
  reviewCount,
}: ReviewsSectionProps) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productSlug]);

  async function fetchReviews() {
    try {
      const res = await fetch(`/api/products/${productSlug}/reviews?limit=5`);
      const data = await res.json();
      setReviews(data.data || []);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleReviewSuccess = () => {
    setShowForm(false);
    // Refresh the page to show the new review in pending state
    window.location.reload();
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Customer Reviews
        </h2>
        {session && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
          >
            Leave a Review
          </button>
        )}
      </div>

      {/* Review Summary */}
      <div className="mb-6 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-4xl font-bold text-[var(--foreground)]">
            {averageRating.toFixed(1)}
          </div>
          <div>
            <StarRating rating={averageRating} reviewCount={0} size="md" />
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Based on {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Loading reviews...
          </p>
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          No reviews yet. Be the first to review!
        </div>
      )}

      {/* Review Form Modal */}
      {showForm && (
        <ReviewForm
          productSlug={productSlug}
          onClose={() => setShowForm(false)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
