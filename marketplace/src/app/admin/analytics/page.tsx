"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, MousePointerClick, Star, TrendingUp, Users } from "lucide-react";
import { DashboardHero, DashboardShell, ThemedLink } from "@/components/dashboard/DashboardChrome";

type Period = "7d" | "30d" | "90d" | "all";

interface AdminAnalytics {
  overview: {
    totalViews: number;
    totalClicks: number;
    totalLeads: number;
    clickThroughRate: number;
    pendingReviews: number;
    approvedReviews: number;
  };
  topOfferings: Array<{
    id: string;
    slug: string;
    title: string;
    partnerName?: string | null;
    views: number;
    clicks: number;
    leads: number;
    averageRating: number;
    reviewCount: number;
  }>;
  topPartners: Array<{
    id: string;
    companyName?: string | null;
    publishedOfferings: number;
    totalLeads: number;
    totalViews: number;
  }>;
  externalRatings: Array<{ source: string; count: number; averageRating: number }>;
  externalDemand: Array<{ category: string; requests: number; clicks: number }>;
}

const periods: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/analytics?period=${period}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load analytics");
        if (!cancelled) setAnalytics(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Admin analytics"
          title="Marketplace Analytics"
          description="Global performance, reviews, and external demand signals across partners and offerings."
          icon={TrendingUp}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/reviews" variant="secondary">Review queue</ThemedLink>
            </>
          }
        />
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
              {periods.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
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
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {loading || !analytics ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Metric title="Views" value={number(analytics.overview.totalViews)} icon={<Eye />} />
              <Metric title="Clicks" value={number(analytics.overview.totalClicks)} icon={<MousePointerClick />} />
              <Metric title="Leads" value={number(analytics.overview.totalLeads)} icon={<Users />} />
              <Metric title="CTR" value={`${analytics.overview.clickThroughRate.toFixed(1)}%`} icon={<BarChart3 />} />
              <Metric title="Pending reviews" value={number(analytics.overview.pendingReviews)} icon={<Star />} />
              <Metric title="Approved reviews" value={number(analytics.overview.approvedReviews)} icon={<Star />} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Top Offerings">
                <Table
                  headers={["Offering", "Views", "Clicks", "Leads", "Rating"]}
                  rows={analytics.topOfferings.map((offering) => [
                    <Link key="title" href={`/offerings/${offering.slug}`} className="font-medium text-[var(--primary)] hover:underline">
                      {offering.title}
                      <span className="block text-xs text-[var(--muted-foreground)]">{offering.partnerName || "Partner"}</span>
                    </Link>,
                    number(offering.views),
                    number(offering.clicks),
                    number(offering.leads),
                    `${offering.averageRating.toFixed(1)} (${offering.reviewCount})`,
                  ])}
                />
              </Panel>

              <Panel title="Top Partners">
                <Table
                  headers={["Partner", "Offerings", "Views", "Leads"]}
                  rows={analytics.topPartners.map((partner) => [
                    partner.companyName || "Partner",
                    number(partner.publishedOfferings),
                    number(partner.totalViews),
                    number(partner.totalLeads),
                  ])}
                />
              </Panel>

              <Panel title="External Ratings Coverage">
                <Table
                  headers={["Source", "Rows", "Avg rating"]}
                  rows={analytics.externalRatings.map((rating) => [
                    rating.source.replace(/_/g, " "),
                    number(rating.count),
                    rating.averageRating.toFixed(1),
                  ])}
                />
              </Panel>

              <Panel title="External Demand Signals">
                <Table
                  headers={["Category", "Requests", "Clicks"]}
                  rows={analytics.externalDemand.map((demand) => [
                    demand.category,
                    number(demand.requests),
                    number(demand.clicks),
                  ])}
                />
              </Panel>
            </div>
          </>
        )}
    </DashboardShell>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--primary)]/10 to-transparent" />
      <div className="relative mb-3 w-fit rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 p-2 text-[var(--primary)] [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <h2 className="border-b border-[var(--border)] px-6 py-4 text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">No data available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-[var(--background)] text-left text-xs uppercase text-[var(--muted-foreground)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-6 py-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-[var(--background)]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 text-[var(--foreground)]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
