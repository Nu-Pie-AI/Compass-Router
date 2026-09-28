"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle,
  Clock,
  ClipboardCheck,
  Lightbulb,
  Package,
  PackageX,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

interface DashboardStats {
  partners: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  offerings: {
    total: number;
    notSubmitted: number;
    pendingApproval: number;
    approved: number;
    needsRevision: number;
    published: number;
    draft: number;
  };
  recentActivity: Array<{
    id: string;
    type: "partner" | "offering";
    action: string;
    entity: string;
    timestamp: string;
  }>;
}

type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<Tone, { icon: string; panel: string; text: string }> = {
  primary: {
    icon: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    panel: "from-[var(--primary)]/12 to-transparent",
    text: "text-[var(--primary)]",
  },
  secondary: {
    icon: "bg-[var(--secondary)]/10 text-[var(--secondary)] border-[var(--secondary)]/20",
    panel: "from-[var(--secondary)]/12 to-transparent",
    text: "text-[var(--secondary)]",
  },
  accent: {
    icon: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    panel: "from-[var(--accent)]/20 to-transparent",
    text: "text-[#8a6512]",
  },
  success: {
    icon: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    panel: "from-[var(--primary)]/12 to-transparent",
    text: "text-[var(--primary)]",
  },
  warning: {
    icon: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    panel: "from-[var(--accent)]/20 to-transparent",
    text: "text-[#8a6512]",
  },
  danger: {
    icon: "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20",
    panel: "from-[var(--error)]/10 to-transparent",
    text: "text-[var(--error)]",
  },
  neutral: {
    icon: "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)]",
    panel: "from-[var(--border)]/35 to-transparent",
    text: "text-[var(--muted-foreground)]",
  },
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError("Failed to load dashboard statistics");
      }
    } catch (err) {
      console.error("Dashboard stats error:", err);
      setError("An error occurred while loading the dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-8 py-7 text-center shadow-ambient">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 sm:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-[var(--error)]/20 bg-[var(--error)]/10 p-4 text-sm font-medium text-[var(--error)]">
            {error || "Failed to load dashboard"}
          </div>
        </div>
      </div>
    );
  }

  const approvalQueue = stats.partners.pending + stats.offerings.pendingApproval;

  const StatCard = ({
    title,
    value,
    icon: Icon,
    tone,
    caption,
  }: {
    title: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    tone: Tone;
    caption?: string;
  }) => (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient">
      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${toneClasses[tone].panel} opacity-80`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className={`rounded-lg border p-2.5 ${toneClasses[tone].icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold leading-none text-[var(--foreground)]">{value}</div>
          {caption && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{caption}</p>}
        </div>
      </div>
      <h3 className="relative mt-5 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
    </div>
  );

  const QuickAction = ({
    href,
    title,
    description,
    value,
    icon: Icon,
    tone,
  }: {
    href?: string;
    title: string;
    description: string;
    value?: string | number;
    icon: ComponentType<{ className?: string }>;
    tone: Tone;
  }) => {
    const content = (
      <div className="group h-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className={`rounded-lg border p-2.5 ${toneClasses[tone].icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          {value !== undefined && <div className="text-3xl font-bold leading-none text-[var(--foreground)]">{value}</div>}
        </div>
        <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        <div className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${toneClasses[tone].text}`}>
          Open
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    );

    if (!href) {
      return (
        <button type="button" onClick={fetchDashboardStats} className="h-full text-left">
          {content}
        </button>
      );
    }

    return <Link href={href}>{content}</Link>;
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="absolute inset-0 bg-mesh opacity-35" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--primary)]">
                <ShieldCheck className="h-4 w-4" />
                Admin control center
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">Admin Dashboard</h1>
              <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">
                Monitor partner approvals, offering quality, marketplace engagement, and moderation queues.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchDashboardStats}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh stats
            </button>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <StatCard title="Approval Queue" value={approvalQueue} icon={Clock} tone="warning" caption="partners + offerings" />
          <StatCard title="Active Partners" value={stats.partners.approved} icon={Users} tone="primary" caption="in good standing" />
          <StatCard title="Live Offerings" value={stats.offerings.published} icon={Package} tone="secondary" caption="published listings" />
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Quick Actions</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Partner, offering, analytics, and moderation workspaces.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QuickAction href="/admin/partners/approve" title="Partner Approvals" description="Review pending partner applications." value={stats.partners.pending} icon={UserCheck} tone="primary" />
            <QuickAction href="/admin/partners" title="Partner Management" description="Manage approved, pending, rejected, and suspended partners." icon={Building2} tone="primary" />
            <QuickAction href="/admin/offerings/review" title="Offering Review" description="Review AI-generated offerings awaiting admin approval." value={stats.offerings.pendingApproval} icon={ClipboardCheck} tone="warning" />
            <QuickAction href="/admin/partners/initiate-onboarding" title="Start Onboarding" description="Initiate AI onboarding for partners from the admin side." icon={UserPlus} tone="accent" />
            <QuickAction href="/admin/analytics" title="Marketplace Analytics" description="Views, clicks, leads, ratings, and demand signals." icon={TrendingUp} tone="secondary" />
            <QuickAction href="/admin/reviews" title="Review Moderation" description="Approve or reject pending marketplace reviews." icon={Star} tone="accent" />
            <QuickAction href="/admin/ai-suggestions" title="AI Suggestions" description="Inspect external recommendations and demand gaps." icon={Lightbulb} tone="secondary" />
            <QuickAction title="Refresh Stats" description="Pull the latest dashboard totals from the admin API." icon={RefreshCcw} tone="neutral" />
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Offering Pipeline</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Status distribution for partner offerings.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Offerings" value={stats.offerings.total} icon={Package} tone="secondary" />
            <StatCard title="Pending Approval" value={stats.offerings.pendingApproval} icon={Clock} tone="warning" />
            <StatCard title="Published" value={stats.offerings.published} icon={CheckCircle} tone="success" />
            <StatCard title="Needs Revision" value={stats.offerings.needsRevision} icon={AlertCircle} tone="danger" />
            <StatCard title="Draft Offerings" value={stats.offerings.draft} icon={PackageX} tone="neutral" />
            <StatCard title="Not Submitted" value={stats.offerings.notSubmitted} icon={XCircle} tone="neutral" />
            <StatCard title="Approved Total" value={stats.offerings.approved} icon={CheckCircle} tone="primary" />
            <StatCard title="Partner Rejections" value={stats.partners.rejected} icon={XCircle} tone="danger" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Recent Activity</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Latest partner and offering changes.</p>
            </div>
            {stats.recentActivity.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[var(--background)] sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg border p-2 ${activity.type === "partner" ? toneClasses.primary.icon : toneClasses.secondary.icon}`}>
                        {activity.type === "partner" ? <Users className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{activity.action}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">{activity.entity}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{new Date(activity.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-[var(--primary)]" />
                <p className="font-medium text-[var(--foreground)]">No recent activity</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">New marketplace events will appear here.</p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Partner Snapshot</h2>
            <div className="mt-5 space-y-4">
              <SnapshotRow label="Total partners" value={stats.partners.total} tone="primary" />
              <SnapshotRow label="Pending partners" value={stats.partners.pending} tone="warning" />
              <SnapshotRow label="Suspended partners" value={stats.partners.suspended} tone="danger" />
              <SnapshotRow label="Approved partners" value={stats.partners.approved} tone="success" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SnapshotRow({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--muted-foreground)]">{label}</span>
      <span className={`text-lg font-bold ${toneClasses[tone].text}`}>{value}</span>
    </div>
  );
}
