"use client";

// ============================================
// PARTNER DASHBOARD
// ============================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  Inbox,
  Layers3,
  Package,
  Pencil,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface Partner {
  id: string;
  companyName: string | null;
  providerType: string;
  website: string | null;
  status: string;
  onboardingStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  totalOfferings: number;
  publishedOfferings: number;
  overallConfidence: number | null;
}

interface Offering {
  id: string;
  slug: string;
  title: string;
  offeringType: string;
  status: string;
  confidenceScore: number | null;
  createdAt: string;
}

type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<Tone, { badge: string; icon: string; text: string; panel: string }> = {
  primary: {
    badge: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    icon: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    text: "text-[var(--primary)]",
    panel: "from-[var(--primary)]/12 to-transparent",
  },
  secondary: {
    badge: "bg-[var(--secondary)]/10 text-[var(--secondary)] border-[var(--secondary)]/20",
    icon: "bg-[var(--secondary)]/10 text-[var(--secondary)] border-[var(--secondary)]/20",
    text: "text-[var(--secondary)]",
    panel: "from-[var(--secondary)]/12 to-transparent",
  },
  accent: {
    badge: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    icon: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    text: "text-[#8a6512]",
    panel: "from-[var(--accent)]/18 to-transparent",
  },
  success: {
    badge: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    icon: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20",
    text: "text-[var(--primary)]",
    panel: "from-[var(--primary)]/12 to-transparent",
  },
  warning: {
    badge: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    icon: "bg-[var(--accent)]/20 text-[#8a6512] border-[var(--accent)]/35",
    text: "text-[#8a6512]",
    panel: "from-[var(--accent)]/18 to-transparent",
  },
  danger: {
    badge: "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20",
    icon: "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20",
    text: "text-[var(--error)]",
    panel: "from-[var(--error)]/10 to-transparent",
  },
  neutral: {
    badge: "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)]",
    icon: "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)]",
    text: "text-[var(--muted-foreground)]",
    panel: "from-[var(--border)]/30 to-transparent",
  },
};

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const partnerRes = await fetch("/api/partners/me");
      if (!partnerRes.ok) {
        if (partnerRes.status === 404) {
          router.push("/partners/offerings/create-ai");
          return;
        }
        throw new Error("Failed to load partner data");
      }
      const partnerData = await partnerRes.json();
      setPartner(partnerData);

      const offeringsRes = await fetch("/api/partners/offerings");
      if (offeringsRes.ok) {
        const offeringsData = await offeringsRes.json();
        setOfferings(offeringsData);
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const draftCount = useMemo(() => offerings.filter((offering) => offering.status === "draft").length, [offerings]);
  const reviewCount = useMemo(
    () => offerings.filter((offering) => offering.status === "pending_review" || offering.status === "pending").length,
    [offerings]
  );

  const getStatusTone = (status: string): Tone => {
    switch (status) {
      case "published":
      case "approved":
        return "success";
      case "pending_review":
      case "pending":
      case "IN_PROGRESS":
        return "warning";
      case "rejected":
      case "suspended":
      case "needs_revision":
        return "danger";
      case "draft":
        return "neutral";
      default:
        return "secondary";
    }
  };

  const getConfidenceTone = (score: number | null): Tone => {
    if (!score) return "neutral";
    if (score >= 85) return "success";
    if (score >= 60) return "warning";
    return "danger";
  };

  const formatLabel = (value: string) => value.replace(/_/g, " ").toLowerCase();

  const primaryActionClass =
    "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)]";
  const secondaryActionClass =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-8 py-7 text-center shadow-ambient">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-ambient">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">No Partner Profile Found</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Create your first offering and we will set up your partner workspace.
          </p>
          <Link href="/partners/offerings/create-ai" className={`${primaryActionClass} mt-6`}>
            Create Offering with AI
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative mb-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="absolute inset-0 bg-mesh opacity-35" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--primary)]">
                <Sparkles className="h-4 w-4" />
                Partner workspace
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
                {partner.companyName || "Partner Dashboard"}
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">
                Manage offerings, review AI-generated content, track leads, and understand marketplace performance.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/partners/offerings/create-ai" className={primaryActionClass}>
                  <Bot className="h-4 w-4" />
                  Create Offering with AI
                </Link>
                <Link href="/partners/bulk-import" className={secondaryActionClass}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Bulk Import
                </Link>
                <Link href="/partners/offerings/review" className={secondaryActionClass}>
                  <ClipboardCheck className="h-4 w-4" />
                  Review Offerings
                </Link>
                <Link href="/partners/dashboard/analytics" className={secondaryActionClass}>
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
                <Link href="/partners/dashboard/leads" className={secondaryActionClass}>
                  <Inbox className="h-4 w-4" />
                  Leads
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-4 backdrop-blur">
              <div className="flex flex-wrap gap-2">
                {partner.onboardingStatus !== "COMPLETED" && (
                  <StatusBadge label={`Onboarding ${formatLabel(partner.onboardingStatus)}`} tone="warning" />
                )}
                <StatusBadge label={formatLabel(partner.status)} tone={getStatusTone(partner.status)} />
              </div>
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-[var(--secondary)] hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">{partner.website}</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {partner.onboardingStatus === "NOT_STARTED" && (
          <section className="mb-8 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Create Your First Offering</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Start with the AI flow to generate a marketplace offering from a short summary and optional website context.
                </p>
              </div>
              <Link href="/partners/offerings/create-ai" className={`${primaryActionClass} whitespace-nowrap`}>
                Create Offering with AI
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Offerings" value={partner.totalOfferings} icon={Package} tone="secondary" />
          <MetricCard title="Published" value={partner.publishedOfferings} icon={CheckCircle} tone="success" />
          <MetricCard title="In Review" value={reviewCount} icon={TrendingUp} tone="warning" />
          <MetricCard title="AI Confidence" value={partner.overallConfidence ? `${partner.overallConfidence}%` : "N/A"} icon={Sparkles} tone={getConfidenceTone(partner.overallConfidence)} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Profile Snapshot</h2>
              <div className="mt-5 space-y-4">
                <SnapshotRow label="Provider type" value={formatLabel(partner.providerType)} tone="secondary" />
                <SnapshotRow label="Draft offerings" value={draftCount.toString()} tone="neutral" />
                <SnapshotRow label="Published offerings" value={partner.publishedOfferings.toString()} tone="success" />
              </div>
            </section>

            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Workspace</h2>
              <div className="mt-4 space-y-2">
                <WorkspaceLink href="/partners/dashboard/analytics" icon={BarChart3} label="Analytics" />
                <WorkspaceLink href="/partners/dashboard/leads" icon={Inbox} label="Leads" />
                <WorkspaceLink href="/partners/offerings/review" icon={ClipboardCheck} label="Review Offerings" />
                <WorkspaceLink href="/partners/bulk-import" icon={FileSpreadsheet} label="Bulk Import" />
                <WorkspaceLink href="/partners/offerings/create-ai" icon={Bot} label="Create with AI" />
              </div>
            </section>
          </aside>

          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Your Offerings</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Review, publish, and inspect active marketplace listings.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/partners/offerings/create-ai" className={primaryActionClass}>
                  <Bot className="h-4 w-4" />
                  Create
                </Link>
                <Link href="/partners/bulk-import" className={secondaryActionClass}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Import
                </Link>
              </div>
            </div>

            {offerings.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Layers3 className="h-6 w-6" />
                </div>
                <p className="text-lg font-bold text-[var(--foreground)]">No offerings yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
                  Create a single AI-assisted offering or bulk import a structured CSV/XLSX file.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link href="/partners/offerings/create-ai" className={primaryActionClass}>
                    Create your first offering
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/partners/bulk-import" className={secondaryActionClass}>
                    Bulk import offerings
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {offerings.map((offering) => {
                  const statusTone = getStatusTone(offering.status);
                  const confidenceTone = getConfidenceTone(offering.confidenceScore);
                  const href =
                    offering.status === "published"
                      ? `/offerings/${offering.slug}`
                      : `/partners/offerings/review/${offering.id}`;

                  return (
                    <div key={offering.id} className="grid gap-4 px-5 py-4 transition hover:bg-[var(--background)] lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-[var(--foreground)]">{offering.title}</h3>
                          <StatusBadge label={offering.offeringType} tone="secondary" />
                          <StatusBadge label={formatLabel(offering.status)} tone={statusTone} />
                        </div>
                        <p className="truncate text-sm text-[var(--muted-foreground)]">/{offering.slug}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                        {offering.confidenceScore && (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-right">
                            <div className={`text-sm font-bold ${toneClasses[confidenceTone].text}`}>{offering.confidenceScore}%</div>
                            <div className="text-xs text-[var(--muted-foreground)]">confidence</div>
                          </div>
                        )}
                        <Link href={href} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface)]">
                          {offering.status === "published" ? (
                            <>
                              View
                              <ArrowRight className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Edit
                              <Pencil className="h-4 w-4" />
                            </>
                          )}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient">
      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${toneClasses[tone].panel} opacity-80`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className={`rounded-lg border p-2.5 ${toneClasses[tone].icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-3xl font-bold leading-none text-[var(--foreground)]">{value}</div>
      </div>
      <h3 className="relative mt-5 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${toneClasses[tone].badge}`}>
      {label}
    </span>
  );
}

function SnapshotRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--muted-foreground)]">{label}</span>
      <span className={`text-right text-sm font-bold capitalize ${toneClasses[tone].text}`}>{value}</span>
    </div>
  );
}

function WorkspaceLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--background)]"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--primary)]" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
    </Link>
  );
}
