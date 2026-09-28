"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, MousePointerClick, Star, TrendingUp, Users } from "lucide-react";
import { DashboardHero, DashboardShell, ThemedLink } from "@/components/dashboard/DashboardChrome";

type Period = "7d" | "30d" | "90d" | "all";

interface PartnerAnalytics {
  overview: {
    totalViews: number;
    totalClicks: number;
    totalLeads: number;
    totalReviews: number;
    averageRating: number;
    clickThroughRate: number;
    viewsChange: number;
    clicksChange: number;
    leadsChange: number;
  };
  offeringStats: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    views: number;
    clicks: number;
    leads: number;
    ctr: number;
    clickTypes: Record<string, number>;
    reviewCount: number;
    averageRating: number;
  }>;
  timeSeriesData: Array<{ date: string; views: number; clicks: number; leads: number }>;
  leadsByStatus: Record<string, number>;
}

const periods: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatChange(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function PartnerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [analytics, setAnalytics] = useState<PartnerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/partners/analytics?period=${period}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load analytics");
        if (!cancelled) setAnalytics(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const maxSeries = Math.max(
    1,
    ...(analytics?.timeSeriesData || []).flatMap((item) => [item.views, item.clicks, item.leads])
  );

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Partner analytics"
          title="Analytics"
          description="Track offering engagement, leads, ratings, and conversion quality."
          icon={BarChart3}
          actions={
            <>
              <ThemedLink href="/partners/dashboard" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/partners/dashboard/leads" variant="secondary">Leads</ThemedLink>
            </>
          }
        />
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
          <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {periods.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  period === item.value
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading || !analytics ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <MetricCard title="Views" value={formatNumber(analytics.overview.totalViews)} change={formatChange(analytics.overview.viewsChange)} icon={<Eye />} />
              <MetricCard title="Clicks" value={formatNumber(analytics.overview.totalClicks)} change={formatChange(analytics.overview.clicksChange)} icon={<MousePointerClick />} />
              <MetricCard title="Leads" value={formatNumber(analytics.overview.totalLeads)} change={formatChange(analytics.overview.leadsChange)} icon={<Users />} />
              <MetricCard title="CTR" value={`${analytics.overview.clickThroughRate.toFixed(1)}%`} icon={<TrendingUp />} />
              <MetricCard title="Avg rating" value={analytics.overview.averageRating.toFixed(1)} sub={`${analytics.overview.totalReviews} reviews`} icon={<Star />} />
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="mb-6 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[var(--primary)]" />
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Engagement Trend</h2>
                </div>
                {analytics.timeSeriesData.length === 0 ? (
                  <EmptyState text="No engagement data for this period." />
                ) : (
                  <div className="space-y-3">
                    {analytics.timeSeriesData.slice(-18).map((item) => (
                      <div key={item.date} className="grid grid-cols-[92px_1fr] items-center gap-3 text-sm">
                        <span className="text-[var(--muted-foreground)]">{item.date.slice(5)}</span>
                        <div className="flex h-8 items-center gap-1">
                          <Bar value={item.views} max={maxSeries} className="bg-[var(--primary)]" />
                          <Bar value={item.clicks} max={maxSeries} className="bg-[var(--secondary)]" />
                          <Bar value={item.leads} max={maxSeries} className="bg-[var(--accent)]" />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 pt-2 text-xs text-[var(--muted-foreground)]">
                      <span>Green: views</span>
                      <span>Blue: clicks</span>
                      <span>Gold: leads</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-5 text-xl font-semibold text-[var(--foreground)]">Lead Funnel</h2>
                {Object.keys(analytics.leadsByStatus).length === 0 ? (
                  <EmptyState text="No leads yet." />
                ) : (
                  <div className="space-y-4">
                    {["new", "contacted", "qualified", "converted", "lost"].map((status) => {
                      const count = analytics.leadsByStatus[status] || 0;
                      const max = Math.max(1, ...Object.values(analytics.leadsByStatus));
                      return (
                        <div key={status}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="capitalize text-[var(--foreground)]">{status}</span>
                            <span className="text-[var(--muted-foreground)]">{count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--background)]">
                            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col gap-2 border-b border-[var(--border)] p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Offering Performance</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">Views, clicks, leads, and ratings by offering.</p>
                </div>
                <Link href="/partners/dashboard/leads" className="text-sm font-medium text-[var(--primary)] hover:underline">
                  Manage leads
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-[var(--background)] text-left text-xs uppercase text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-6 py-3">Offering</th>
                      <th className="px-6 py-3">Views</th>
                      <th className="px-6 py-3">Clicks</th>
                      <th className="px-6 py-3">CTR</th>
                      <th className="px-6 py-3">Leads</th>
                      <th className="px-6 py-3">Rating</th>
                      <th className="px-6 py-3">Top click</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {analytics.offeringStats.map((offering) => {
                      const topClick = Object.entries(offering.clickTypes).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <tr key={offering.id} className="hover:bg-[var(--background)]">
                          <td className="px-6 py-4">
                            <div className="font-medium text-[var(--foreground)]">{offering.title}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">/{offering.slug}</div>
                          </td>
                          <td className="px-6 py-4 text-[var(--foreground)]">{formatNumber(offering.views)}</td>
                          <td className="px-6 py-4 text-[var(--foreground)]">{formatNumber(offering.clicks)}</td>
                          <td className="px-6 py-4 text-[var(--foreground)]">{offering.ctr.toFixed(1)}%</td>
                          <td className="px-6 py-4 text-[var(--foreground)]">{formatNumber(offering.leads)}</td>
                          <td className="px-6 py-4 text-[var(--foreground)]">{offering.averageRating.toFixed(1)} ({offering.reviewCount})</td>
                          <td className="px-6 py-4 capitalize text-[var(--muted-foreground)]">{topClick ? `${topClick[0]} (${topClick[1]})` : "None"}</td>
                          <td className="px-6 py-4">
                            <Link href={`/offerings/${offering.slug}`} className="font-medium text-[var(--primary)] hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
    </DashboardShell>
  );
}

function MetricCard({
  title,
  value,
  change,
  sub,
  icon,
}: {
  title: string;
  value: string;
  change?: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--primary)]/10 to-transparent" />
      <div className="mb-4 flex items-center justify-between">
        <div className="relative rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 p-2 text-[var(--primary)] [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        {change && <span className="text-xs font-medium text-[var(--muted-foreground)]">{change}</span>}
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return <div className={`h-4 min-w-1 rounded-sm ${className}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} title={`${value}`} />;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">{text}</div>;
}
