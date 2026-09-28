"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Star, X } from "lucide-react";
import { DashboardHero, DashboardShell, StatusPill, ThemedLink } from "@/components/dashboard/DashboardChrome";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

const statuses = ["pending", "approved", "rejected", "all"] as const;
type Status = (typeof statuses)[number];

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  pros?: string | null;
  cons?: string | null;
  status: string;
  moderationReason?: string | null;
  createdAt: string;
  user: { name?: string | null; email?: string | null };
  offering?: { slug: string; title: string; partner?: { companyName?: string | null } | null } | null;
  product?: { slug: string; name: string } | null;
}

export default function AdminReviewsPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function loadReviews() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reviews?status=${status}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load reviews");
      setReviews(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [status]);

  async function moderate(id: string, action: "approve" | "reject") {
    try {
      const response = await fetch(`/api/admin/reviews/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason }) : "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} review`);
      setRejectingId(null);
      setReason("");
      toastSuccess(action === "approve" ? "Review approved" : "Review rejected");
      await loadReviews();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${action} review`;
      setError(message);
      toastError(`Failed to ${action} review`, message);
    }
  }

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Admin moderation"
          title="Review Moderation"
          description="Approve or reject marketplace reviews before they appear publicly."
          icon={Star}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/analytics" variant="secondary">Analytics</ThemedLink>
            </>
          }
        />

        <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition ${
                status === item
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted-foreground)] shadow-sm">
            Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm">
            <p className="font-medium text-[var(--foreground)]">No reviews found</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">This queue is clear.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const target = review.offering ? (
                <Link href={`/offerings/${review.offering.slug}`} className="text-[var(--primary)] hover:underline">
                  {review.offering.title}
                </Link>
              ) : review.product ? (
                <span>{review.product.name}</span>
              ) : (
                <span>Unknown listing</span>
              );

              return (
                <article key={review.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {target} · {review.user?.name || review.user?.email || "User"} · {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{review.title}</h2>
                      <div className="mt-1 text-sm font-medium text-[var(--primary)]">{review.rating}/5 stars</div>
                    </div>
                    <StatusPill label={review.status} tone={review.status === "approved" ? "success" : review.status === "rejected" ? "danger" : "warning"} />
                  </div>

                  <p className="leading-7 text-[var(--muted-foreground)]">{review.content}</p>

                  {(review.pros || review.cons) && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {review.pros && <InfoBox title="Pros" text={review.pros} />}
                      {review.cons && <InfoBox title="Cons" text={review.cons} />}
                    </div>
                  )}

                  {review.moderationReason && (
                    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted-foreground)]">
                      Reason: {review.moderationReason}
                    </div>
                  )}

                  {review.status === "pending" && (
                    <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                      {rejectingId === review.id && (
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Optional rejection reason"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => moderate(review.id, "approve")}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => (rejectingId === review.id ? moderate(review.id, "reject") : setRejectingId(review.id))}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
                      >
                        <X className="h-4 w-4" />
                        {rejectingId === review.id ? "Confirm reject" : "Reject"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
    </DashboardShell>
  );
}

function InfoBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="mb-1 text-sm font-medium text-[var(--foreground)]">{title}</p>
      <p className="text-sm text-[var(--muted-foreground)]">{text}</p>
    </div>
  );
}
