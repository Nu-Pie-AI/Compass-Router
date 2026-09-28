import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export type DashboardTone = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";

export const dashboardTone: Record<DashboardTone, { badge: string; icon: string; text: string; panel: string }> = {
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

export function DashboardShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div>
    </div>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <div className="absolute inset-0 bg-mesh opacity-35" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--primary)]">
            <Icon className="h-4 w-4" />
            {eyebrow}
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function MetricTile({
  title,
  value,
  icon: Icon,
  tone = "primary",
  caption,
}: {
  title: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: DashboardTone;
  caption?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient">
      <div className={`absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${dashboardTone[tone].panel} opacity-80`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className={`rounded-lg border p-2.5 ${dashboardTone[tone].icon}`}>
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
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: DashboardTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${dashboardTone[tone].badge}`}>
      {label}
    </span>
  );
}

export function ThemedLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        variant === "primary"
          ? "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)]"
          : "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
      }
    >
      {children}
    </Link>
  );
}

export function ActionTile({
  href,
  title,
  description,
  icon: Icon,
  tone = "primary",
  value,
}: {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone?: DashboardTone;
  value?: ReactNode;
}) {
  return (
    <Link href={href} className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className={`rounded-lg border p-2.5 ${dashboardTone[tone].icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        {value !== undefined && <div className="text-3xl font-bold leading-none text-[var(--foreground)]">{value}</div>}
      </div>
      <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      <div className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${dashboardTone[tone].text}`}>
        Open
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
