"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  pros?: string | null;
  cons?: string | null;
  userRole?: string | null;
  companySize?: string | null;
  industry?: string | null;
  usageDuration?: string | null;
  createdAt: string;
  helpfulCount: number;
  notHelpfulCount: number;
  user: { name?: string | null };
}

interface ReviewsSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<number, number>;
}

interface OfferingReviewsSectionProps {
  slug: string;
  initialAverageRating: number;
  initialReviewCount: number;
}

const defaultSummary: ReviewsSummary = {
  averageRating: 0,
  reviewCount: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export function OfferingReviewsSection({
  slug,
  initialAverageRating,
  initialReviewCount,
}: OfferingReviewsSectionProps) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewsSummary>({
    ...defaultSummary,
    averageRating: initialAverageRating,
    reviewCount: initialReviewCount,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/offerings/${slug}/reviews?limit=6`);
      const data = await response.json();
      if (response.ok) {
        setReviews(data.data || []);
        setSummary(
          data.summary || {
            ...defaultSummary,
            averageRating: initialAverageRating,
            reviewCount: initialReviewCount,
          }
        );
      }
    } catch (error) {
      console.error("Failed to fetch offering reviews:", error);
    } finally {
      setIsLoading(false);
    }
  }, [initialAverageRating, initialReviewCount, slug]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function trackReviewClick() {
    try {
      await fetch(`/api/offerings/${slug}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickType: "review" }),
        keepalive: true,
      });
    } catch {
      // Silent by design.
    }
  }

  const openReviewForm = () => {
    trackReviewClick();
    setIsFormOpen(true);
  };

  async function handleVote(reviewId: string, helpful: boolean) {
    if (!session) {
      window.location.href = `/login?callbackUrl=/offerings/${slug}`;
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to vote");
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                helpfulCount: data.data.helpfulCount,
                notHelpfulCount: data.data.notHelpfulCount,
              }
            : review
        )
      );
    } catch (error) {
      toastError("Failed to vote", error instanceof Error ? error.message : "Please try again");
    }
  }

  return (
    <section id="reviews" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Reviews</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Marketplace feedback from approved reviews.
          </p>
        </div>
        {session ? (
          <button
            type="button"
            onClick={openReviewForm}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-white transition hover:opacity-90"
          >
            Leave a Review
          </button>
        ) : (
          <Link
            href={`/login?callbackUrl=/offerings/${slug}`}
            onClick={trackReviewClick}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-center font-semibold text-white transition hover:opacity-90"
          >
            Sign in to Review
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="rounded-lg bg-[var(--background)] p-5 text-center">
          <div className="text-4xl font-bold text-[var(--foreground)]">
            {summary.averageRating.toFixed(1)}
          </div>
          <div className="mt-2 flex justify-center">
            <StarRating rating={summary.averageRating} reviewCount={0} size="sm" />
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution?.[star] || 0;
            const percentage = summary.reviewCount > 0 ? (count / summary.reviewCount) * 100 : 0;
            return (
              <div key={star} className="grid grid-cols-[56px_1fr_36px] items-center gap-3 text-sm">
                <span className="text-[var(--muted-foreground)]">{star} star</span>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
                  <div className="h-full bg-[var(--secondary)]" style={{ width: `${percentage}%` }} />
                </div>
                <span className="text-right text-[var(--muted-foreground)]">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          Loading reviews...
        </div>
      ) : reviews.length > 0 ? (
        <div className="divide-y divide-[var(--border)]">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} onVote={handleVote} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <p className="font-medium text-[var(--foreground)]">No approved reviews yet</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Be the first to share a moderated marketplace review.
          </p>
        </div>
      )}

      {isFormOpen && (
        <ReviewFormModal
          slug={slug}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchReviews();
          }}
        />
      )}
    </section>
  );
}

function ReviewItem({
  review,
  onVote,
}: {
  review: Review;
  onVote: (reviewId: string, helpful: boolean) => void;
}) {
  const date = new Date(review.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StarRating rating={review.rating} reviewCount={0} size="sm" showCount={false} />
          <h3 className="mt-2 font-semibold text-[var(--foreground)]">{review.title}</h3>
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">{date}</span>
      </div>

      <p className="mb-3 text-sm text-[var(--muted-foreground)]">
        {review.user?.name || "Anonymous"}
        {review.userRole ? ` - ${review.userRole}` : ""}
        {review.companySize ? ` - ${review.companySize}` : ""}
        {review.industry ? ` - ${review.industry}` : ""}
      </p>

      <p className="leading-relaxed text-[var(--muted-foreground)]">{review.content}</p>

      {(review.pros || review.cons) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {review.pros && (
            <div className="rounded-lg bg-green-50 p-4">
              <p className="mb-1 text-sm font-semibold text-green-700">Pros</p>
              <p className="text-sm text-green-900">{review.pros}</p>
            </div>
          )}
          {review.cons && (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="mb-1 text-sm font-semibold text-red-700">Cons</p>
              <p className="text-sm text-red-900">{review.cons}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4 text-sm">
        <span className="text-[var(--muted-foreground)]">Was this helpful?</span>
        <button
          type="button"
          onClick={() => onVote(review.id, true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
        >
          <ThumbsUp className="h-4 w-4" />
          {review.helpfulCount}
        </button>
        <button
          type="button"
          onClick={() => onVote(review.id, false)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
        >
          <ThumbsDown className="h-4 w-4" />
          {review.notHelpfulCount}
        </button>
      </div>
    </article>
  );
}

function ReviewFormModal({
  slug,
  onClose,
  onSuccess,
}: {
  slug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [userRole, setUserRole] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [usageDuration, setUsageDuration] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (rating === 0) {
      setError("Please select a rating.");
      toastError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/offerings/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title,
          content,
          pros,
          cons,
          userRole,
          companySize,
          industry,
          usageDuration,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      onSuccess();
      toastSuccess("Review submitted", "It will appear after moderation.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit review";
      setError(message);
      toastError("Failed to submit review", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[var(--surface)] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] p-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Leave a Review</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Reviews are published after moderation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            aria-label="Close review form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submitReview} className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="rounded p-1"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-[var(--secondary)] text-[var(--secondary)]"
                        : "text-[var(--border)]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-medium text-[var(--foreground)]">
            Review title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={5}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--foreground)]">
            Review
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              minLength={50}
              maxLength={2000}
              rows={5}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
              {content.length}/2000 characters
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Pros
              <textarea
                value={pros}
                onChange={(event) => setPros(event.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Cons
              <textarea
                value={cons}
                onChange={(event) => setCons(event.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Role" value={userRole} onChange={setUserRole} />
            <InputField label="Company size" value={companySize} onChange={setCompanySize} />
            <InputField label="Industry" value={industry} onChange={setIndustry} />
            <InputField label="Usage duration" value={usageDuration} onChange={setUsageDuration} />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--foreground)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
      />
    </label>
  );
}
