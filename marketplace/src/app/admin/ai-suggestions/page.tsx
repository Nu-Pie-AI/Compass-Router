'use client';

import { useState, useEffect } from 'react';
import { Search, ExternalLink, TrendingUp, Filter, Lightbulb } from 'lucide-react';
import { DashboardHero, DashboardShell, ThemedLink } from '@/components/dashboard/DashboardChrome';

interface ExternalRecommendation {
  id: string;
  productName: string;
  productUrl: string | null;
  category: string;
  shortDescription: string;
  confidence: number;
  clickCount: number;
  source: string;
  createdAt: string;
}

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export default function AIsuggetsionsPage() {
  const [recommendations, setRecommendations] = useState<ExternalRecommendation[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch recommendations
  useEffect(() => {
    fetchRecommendations();
  }, [category, currentPage]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      if (category !== 'all') {
        params.append('category', category);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/admin/ai-suggestions?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      setRecommendations(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecommendations();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading && recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">Loading AI suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Admin intelligence"
          title="AI External Suggestions"
          description="Track external recommendations suggested by AI when no marketplace matches exist."
          icon={Lightbulb}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/analytics" variant="secondary">Analytics</ThemedLink>
            </>
          }
        />

        {/* Filters & Search */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
              >
                <option value="all">All Categories</option>
                <option value="CRM">CRM</option>
                <option value="Accounting">Accounting</option>
                <option value="HRTech">HRTech</option>
                <option value="Marketing">Marketing</option>
                <option value="IT Services">IT Services</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="ERP">ERP</option>
                <option value="Projects">Projects</option>
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                Search Product Name
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter product name..."
                  className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                />
                <button
                  type="submit"
                className="px-6 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        {meta && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Total Suggestions</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{meta.totalItems}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-[var(--primary)]" />
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Total Clicks</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {recommendations.reduce((sum, rec) => sum + rec.clickCount, 0)}
                  </p>
                </div>
                <ExternalLink className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Avg Confidence</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {recommendations.length > 0
                      ? Math.round(
                          (recommendations.reduce((sum, rec) => sum + rec.confidence, 0) /
                            recommendations.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-[var(--error)] p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recommendations.length > 0 ? (
                  recommendations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[var(--background)]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-[var(--foreground)]">
                          {rec.productName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {rec.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                          {rec.shortDescription}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {Math.round(rec.confidence * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-xs font-medium bg-[var(--background)] text-[var(--foreground)] rounded">
                          {rec.clickCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]">
                        {formatDate(rec.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rec.productUrl ? (
                          <a
                            href={rec.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Visit
                          </a>
                        ) : (
                          <span className="text-[var(--muted-foreground)] text-sm">No URL</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                      No external recommendations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
              <div className="text-sm text-[var(--muted-foreground)]">
                Showing {(meta.currentPage - 1) * meta.itemsPerPage + 1} to{' '}
                {Math.min(meta.currentPage * meta.itemsPerPage, meta.totalItems)} of{' '}
                {meta.totalItems} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={currentPage === meta.totalPages}
                  className="px-4 py-2 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
    </DashboardShell>
  );
}
