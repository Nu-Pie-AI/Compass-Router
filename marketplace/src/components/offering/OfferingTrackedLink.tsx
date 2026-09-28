"use client";

import { ExternalLink } from "lucide-react";

interface OfferingTrackedLinkProps {
  slug: string;
  href: string;
  clickType: string;
  children: React.ReactNode;
}

export function OfferingTrackedLink({
  slug,
  href,
  clickType,
  children,
}: OfferingTrackedLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        fetch(`/api/offerings/${slug}/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clickType }),
          keepalive: true,
        }).catch(() => {});
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
