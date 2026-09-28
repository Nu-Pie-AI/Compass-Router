'use client';

// ============================================
// ADMIN: Offerings Review Queue
// ============================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, ClipboardCheck, Gauge, Package, TriangleAlert } from 'lucide-react';
import { DashboardHero, DashboardShell, MetricTile, StatusPill, ThemedLink } from '@/components/dashboard/DashboardChrome';

interface OfferingForReview {
  id: string;
  slug: string;
  title: string;
  offeringType: string;
  primaryFunction: string;
  confidenceScore: number | null;
  status: string;
  aiGenerated: boolean;
  humanReviewed: boolean;
  createdAt: string;
  partner: {
    id: string;
    companyName: string;
  };
}

export default function AdminOfferingsReviewPage() {
  const [offerings, setOfferings] = useState<OfferingForReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low' | 'medium'>('all');

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const response = await fetch('/api/admin/offerings/pending');
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
    if (score >= 85) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  const filteredOfferings = offerings.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'low') return o.confidenceScore && o.confidenceScore < 60;
    if (filter === 'medium') return o.confidenceScore && o.confidenceScore >= 60 && o.confidenceScore < 85;
    return true;
  });

  const stats = {
    total: offerings.length,
    low: offerings.filter((o) => o.confidenceScore && o.confidenceScore < 60).length,
    medium: offerings.filter((o) => o.confidenceScore && o.confidenceScore >= 60 && o.confidenceScore < 85).length,
    high: offerings.filter((o) => o.confidenceScore && o.confidenceScore >= 85).length,
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
          eyebrow="Admin offering review"
          title="Offerings Review Queue"
          description="Review and approve AI-generated offerings before they go live."
          icon={ClipboardCheck}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/analytics" variant="secondary">Analytics</ThemedLink>
            </>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricTile title="Total Pending" value={stats.total} icon={Package} tone="secondary" />
          <MetricTile title="Low Confidence" value={stats.low} icon={TriangleAlert} tone="danger" caption="<60%" />
          <MetricTile title="Medium Confidence" value={stats.medium} icon={Gauge} tone="warning" caption="60-84%" />
          <MetricTile title="High Confidence" value={stats.high} icon={CheckCircle} tone="success" caption="85%+" />
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] rounded-lg shadow-sm p-4 border border-[var(--border)] mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Filter:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'low'
                  ? 'bg-red-600 text-white'
                  : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
              }`}
            >
              Low Confidence ({stats.low})
            </button>
            <button
              onClick={() => setFilter('medium')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'medium'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
              }`}
            >
              Medium Confidence ({stats.medium})
            </button>
          </div>
        </div>

        {/* Offerings Table */}
        {filteredOfferings.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)] text-center">
            <p className="text-[var(--muted-foreground)]">No offerings pending review</p>
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Offering</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Partner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Function</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredOfferings.map((offering) => (
                  <tr key={offering.id} className="hover:bg-[var(--background)]">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--foreground)]">{offering.title}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">/{offering.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--foreground)]">{offering.partner.companyName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill label={offering.offeringType} tone="secondary" />
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--foreground)]">{offering.primaryFunction}</td>
                    <td className="px-6 py-4">
                      {offering.confidenceScore && (
                        <div
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border-2 ${getConfidenceColor(
                            offering.confidenceScore
                          )}`}
                        >
                          <span className="font-bold">{offering.confidenceScore}%</span>
                          <span className="text-xs">{getConfidenceLabel(offering.confidenceScore)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusPill label={offering.status.replace('_', ' ')} tone={offering.status === 'published' ? 'success' : 'warning'} />
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
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/offerings/review/${offering.id}`}
                        className="font-medium text-sm text-[var(--primary)] hover:underline"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bulk Actions */}
        {filteredOfferings.length > 0 && (
          <div className="mt-6 bg-[var(--surface)] rounded-lg shadow-sm p-6 border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Bulk Actions</h2>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  const highConfidence = filteredOfferings.filter(
                    (o) => o.confidenceScore && o.confidenceScore >= 85
                  );
                  if (
                    confirm(
                      `Approve ${highConfidence.length} high-confidence offering(s)? This will publish them immediately.`
                    )
                  ) {
                    await Promise.all(
                      highConfidence.map((o) =>
                        fetch(`/api/admin/offerings/${o.id}/approve`, { method: 'POST' })
                      )
                    );
                    loadOfferings();
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Approve All High Confidence ({stats.high})
              </button>
            </div>
          </div>
        )}
    </DashboardShell>
  );
}
