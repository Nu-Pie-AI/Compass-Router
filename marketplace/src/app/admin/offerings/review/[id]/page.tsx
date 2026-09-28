'use client';

// ============================================
// ADMIN: Individual Offering Review
// ============================================

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toastSuccess, toastError, toastWarning } from '@/lib/toast-helpers';

interface OfferingData {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  offeringType: string;
  primaryFunction: string;
  useCases: string[];
  painPointsSolved: string[];
  integrations: string[];
  icpTeamSize: string;
  icpBudget: string;
  pricingModel: string;
  startingPrice: number | null;
  confidenceScore: number | null;
  status: string;
  aiGenerated: boolean;
  humanReviewed: boolean;
  partner: {
    companyName: string;
    website: string;
  };
  externalRatings?: Array<{
    id: string;
    source: string;
    rating: number;
    reviewCount: number;
    url?: string | null;
    lastSyncedAt?: string | null;
  }>;
}

export default function AdminOfferingReviewPage() {
  const router = useRouter();
  const params = useParams();
  const offeringId = params.id as string;

  const [offering, setOffering] = useState<OfferingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [syncingRatings, setSyncingRatings] = useState(false);

  useEffect(() => {
    loadOffering();
  }, [offeringId]);

  const loadOffering = async () => {
    try {
      const response = await fetch(`/api/admin/offerings/${offeringId}`);
      if (response.ok) {
        const data = await response.json();
        setOffering(data);
      }
    } catch (error) {
      console.error('Failed to load offering:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/admin/offerings/${offeringId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        toastSuccess('Offering approved and published!', 'Partner has been notified');
        router.push('/admin/offerings/review');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      toastError('Failed to approve offering', 'Please try again');
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      toastWarning('Rejection reason required', 'Please explain why this offering is being rejected');
      return;
    }

    try {
      const response = await fetch(`/api/admin/offerings/${offeringId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: notes }),
      });

      if (response.ok) {
        toastSuccess('Offering rejected', 'Partner has been notified');
        router.push('/admin/offerings/review');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      toastError('Failed to reject offering', 'Please try again');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'border-green-500 bg-green-50';
    if (score >= 60) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const syncExternalRatings = async () => {
    setSyncingRatings(true);
    try {
      const response = await fetch(`/api/admin/offerings/${offeringId}/external-ratings/sync`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync external ratings');
      }
      toastSuccess('External ratings sync complete', `${data.upserted} rating source(s) updated`);
      loadOffering();
    } catch (error) {
      toastError('External ratings sync failed', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setSyncingRatings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!offering) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">Offering Not Found</h2>
          <Link href="/admin/offerings/review" className="text-blue-600 hover:underline">
            Back to Review Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Admin Review</h1>
              <p className="text-[var(--muted-foreground)]">Review AI-generated offering data</p>
            </div>
            <Link
              href="/admin/offerings/review"
              className="bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              ← Back to Queue
            </Link>
          </div>

          {/* Confidence & Status */}
          <div className="grid grid-cols-3 gap-4">
            {offering.confidenceScore && (
              <div className={`p-4 rounded-lg border-2 ${getConfidenceColor(offering.confidenceScore)}`}>
                <div className="text-sm font-medium text-[var(--muted-foreground)]">AI Confidence</div>
                <div className="text-3xl font-bold text-[var(--foreground)]">{offering.confidenceScore}%</div>
              </div>
            )}
            <div className="p-4 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)]">
              <div className="text-sm font-medium text-[var(--muted-foreground)]">Partner</div>
              <div className="text-lg font-bold text-[var(--foreground)]">{offering.partner.companyName}</div>
              <a
                href={offering.partner.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Visit Website →
              </a>
            </div>
            <div className="p-4 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)]">
              <div className="text-sm font-medium text-[var(--muted-foreground)]">Status</div>
              <div className="flex flex-col gap-2 mt-2">
                {offering.aiGenerated && (
                  <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    AI Generated
                  </span>
                )}
                {offering.humanReviewed && (
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Human Reviewed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Layout: AI Data (left) | Review Form (right) */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: AI-Generated Data (Read-only) */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">AI-Generated Data</h2>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Basic Info</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Title</div>
                  <div className="text-[var(--foreground)]">{offering.title}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Type</div>
                  <div className="text-[var(--foreground)]">{offering.offeringType}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Primary Function</div>
                  <div className="text-[var(--foreground)]">{offering.primaryFunction}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Short Description</div>
                  <div className="text-[var(--foreground)]">{offering.shortDescription}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Full Description</div>
                  <div className="text-[var(--foreground)] text-sm">{offering.description}</div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Use Cases</h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--foreground)]">
                {offering.useCases.map((useCase, i) => (
                  <li key={i}>{useCase}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Pain Points Solved</h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--foreground)]">
                {offering.painPointsSolved.map((pain, i) => (
                  <li key={i}>{pain}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Integrations</h3>
              <div className="flex flex-wrap gap-2">
                {offering.integrations.map((integration, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                    {integration}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Ideal Customer Profile</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">Team Size:</span>{' '}
                  <span className="text-[var(--foreground)]">{offering.icpTeamSize}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">Budget:</span>{' '}
                  <span className="text-[var(--foreground)]">{offering.icpBudget}</span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Pricing</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">Model:</span>{' '}
                  <span className="text-[var(--foreground)]">{offering.pricingModel}</span>
                </div>
                {offering.startingPrice && (
                  <div>
                    <span className="text-sm font-medium text-[var(--muted-foreground)]">Starting Price:</span>{' '}
                    <span className="text-[var(--foreground)]">${offering.startingPrice}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[var(--foreground)]">External Ratings</h3>
                <button
                  type="button"
                  onClick={syncExternalRatings}
                  disabled={syncingRatings || offering.status !== 'published'}
                  className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {syncingRatings ? 'Syncing...' : 'Sync Ratings'}
                </button>
              </div>
              {offering.status !== 'published' && (
                <p className="mb-3 text-sm text-[var(--muted-foreground)]">
                  Ratings sync runs after an offering is published.
                </p>
              )}
              {offering.externalRatings && offering.externalRatings.length > 0 ? (
                <div className="space-y-3">
                  {offering.externalRatings.map((rating) => (
                    <a
                      key={rating.id}
                      href={rating.url || '#'}
                      target={rating.url ? '_blank' : undefined}
                      rel={rating.url ? 'noopener noreferrer' : undefined}
                      className="block rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--foreground)]">{rating.source.replace(/_/g, ' ')}</span>
                        <span className="text-[var(--foreground)]">{rating.rating.toFixed(1)}/5</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {rating.reviewCount.toLocaleString()} reviews
                        {rating.lastSyncedAt ? ` · synced ${new Date(rating.lastSyncedAt).toLocaleDateString()}` : ''}
                      </p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">No external ratings stored yet.</p>
              )}
            </div>
          </div>

          {/* Right: Review Form */}
          <div className="space-y-6 sticky top-8 self-start">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Admin Decision</h2>

            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Review Actions</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                    Decision
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAction('approve')}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        action === 'approve'
                          ? 'bg-green-600 text-white'
                          : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
                      }`}
                    >
                      ✓ Approve & Publish
                    </button>
                    <button
                      onClick={() => setAction('reject')}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        action === 'reject'
                          ? 'bg-red-600 text-white'
                          : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
                      }`}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                    {action === 'approve' ? 'Notes (optional)' : 'Rejection Reason (required)'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      action === 'approve'
                        ? 'Add any notes about this approval...'
                        : 'Explain why this offering is being rejected...'
                    }
                  />
                </div>

                {action === 'approve' && (
                  <button
                    onClick={handleApprove}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Confirm Approval
                  </button>
                )}

                {action === 'reject' && (
                  <button
                    onClick={handleReject}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Confirm Rejection
                  </button>
                )}
              </div>
            </div>

            {/* Quality Indicators */}
            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-3">Review Checklist</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-blue-900">Use cases are accurate and specific</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-blue-900">Pain points match target audience</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-blue-900">Pricing information is clear</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-blue-900">No misleading or false claims</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span className="text-blue-900">Integrations list is realistic</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
