'use client';

// ============================================
// PARTNER OFFERINGS REVIEW
// ============================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { DashboardHero, DashboardShell, StatusPill, ThemedLink } from '@/components/dashboard/DashboardChrome';

interface Offering {
  id: string;
  slug: string;
  title: string;
  offeringType: string;
  status: string;
  confidenceScore: number | null;
  createdAt: string;
}

export default function OfferingsReviewPage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const response = await fetch('/api/partners/offerings');
      if (response.ok) {
        const data = await response.json();
        setOfferings(data);
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 85) return 'High Confidence - Ready to Publish';
    if (score >= 60) return 'Medium Confidence - Review Recommended';
    return 'Low Confidence - Needs Editing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-[var(--background)] text-[var(--foreground)]';
      default:
        return 'bg-[var(--background)] text-[var(--foreground)]';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Partner offering review"
          title="Review Your Offerings"
          description="Review AI-generated data and edit low-confidence fields before publishing."
          icon={ClipboardCheck}
          actions={
            <>
              <ThemedLink href="/partners/dashboard" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/partners/offerings/create-ai" variant="primary">Create with AI</ThemedLink>
            </>
          }
        />
      <>
        {/* Header */}
        <div className="hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Review Your Offerings</h1>
              <p className="text-[var(--muted-foreground)]">
                Review AI-generated data and edit low-confidence fields before publishing
              </p>
            </div>
            <Link
              href="/partners/dashboard"
              className="bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Confidence Legend */}
        <div className="bg-[var(--surface)] rounded-lg shadow-sm p-6 border border-[var(--border)] mb-6">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Confidence Levels</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <div>
                <div className="font-semibold text-[var(--foreground)]">High (85%+)</div>
                <div className="text-sm text-[var(--muted-foreground)]">Ready to publish - data is accurate</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <div>
                <div className="font-semibold text-[var(--foreground)]">Medium (60-84%)</div>
                <div className="text-sm text-[var(--muted-foreground)]">Review recommended - verify key fields</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <div>
                <div className="font-semibold text-[var(--foreground)]">Low (&lt;60%)</div>
                <div className="text-sm text-[var(--muted-foreground)]">Needs editing - critical data missing</div>
              </div>
            </div>
          </div>
        </div>

        {/* Offerings Grid */}
        {offerings.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)] text-center">
            <p className="text-[var(--muted-foreground)] mb-4">No offerings found</p>
            <Link
              href="/partners/offerings/create-ai"
              className="text-blue-600 hover:underline font-medium"
            >
              Create an offering with AI
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerings.map((offering) => (
              <div
                key={offering.id}
                className="bg-[var(--surface)] rounded-lg shadow-sm border hover:shadow-ambient transition-all"
                style={{
                  borderColor:
                    offering.confidenceScore && offering.confidenceScore >= 85
                      ? '#22c55e'
                      : offering.confidenceScore && offering.confidenceScore >= 60
                      ? '#eab308'
                      : '#ef4444',
                }}
              >
                <div className="p-6">
                  {/* Title and Type */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">{offering.title}</h3>
                    <StatusPill label={offering.offeringType} tone="secondary" />
                  </div>

                  {/* Confidence Score */}
                  {offering.confidenceScore && (
                    <div className="mb-4">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${getConfidenceColor(
                          offering.confidenceScore
                        )}`}
                      >
                        <div className="text-2xl font-bold">{offering.confidenceScore}%</div>
                        <div className="text-xs">{getConfidenceLabel(offering.confidenceScore)}</div>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(offering.status)}`}>
                      {offering.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/partners/offerings/review/${offering.id}`}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                    >
                      {offering.confidenceScore && offering.confidenceScore < 85 ? 'Review & Edit' : 'View Details'}
                    </Link>
                    {offering.status === 'draft' && offering.confidenceScore && offering.confidenceScore >= 85 && (
                      <button
                        onClick={async () => {
                          // Quick publish for high-confidence offerings
                          const response = await fetch(`/api/partners/offerings/${offering.id}/publish`, {
                            method: 'POST',
                          });
                          if (response.ok) {
                            loadOfferings();
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Actions */}
        {offerings.length > 0 && (
          <div className="mt-8 bg-[var(--surface)] rounded-lg shadow-sm p-6 border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Bulk Actions</h2>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  // Publish all high-confidence offerings
                  const highConfidence = offerings.filter(
                    (o) => o.status === 'draft' && o.confidenceScore && o.confidenceScore >= 85
                  );
                  await Promise.all(
                    highConfidence.map((o) =>
                      fetch(`/api/partners/offerings/${o.id}/publish`, { method: 'POST' })
                    )
                  );
                  loadOfferings();
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Publish All High Confidence ({offerings.filter((o) => o.confidenceScore && o.confidenceScore >= 85 && o.status === 'draft').length})
              </button>
              <button
                onClick={() => {
                  // Filter to show only low confidence
                  const lowConfidence = offerings.filter((o) => o.confidenceScore && o.confidenceScore < 60);
                  if (lowConfidence.length > 0) {
                    router.push(`/partners/offerings/review/${lowConfidence[0].id}`);
                  }
                }}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Review Low Confidence First
              </button>
            </div>
          </div>
        )}
      </>
    </DashboardShell>
  );
}
