"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Mail, RefreshCcw } from "lucide-react";
import { DashboardHero, DashboardShell, ThemedLink } from "@/components/dashboard/DashboardChrome";

const statuses = ["all", "new", "contacted", "qualified", "converted", "lost"] as const;
type LeadStatus = (typeof statuses)[number];

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  message: string;
  status: string;
  createdAt: string;
  offering?: { slug: string; title: string } | null;
}

export default function PartnerLeadsPage() {
  const [status, setStatus] = useState<LeadStatus>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/partners/leads?status=${status}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load leads");
      setLeads(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [status]);

  async function updateStatus(id: string, nextStatus: string) {
    const previous = leads;
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status: nextStatus } : lead)));

    try {
      const response = await fetch(`/api/partners/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update lead");
      setLeads((current) => current.map((lead) => (lead.id === id ? data.data : lead)));
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : "Failed to update lead");
    }
  }

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Partner leads"
          title="Leads"
          description="Manage contact requests from your published offerings."
          icon={Inbox}
          actions={
            <>
              <ThemedLink href="/partners/dashboard" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/partners/dashboard/analytics" variant="secondary">Analytics</ThemedLink>
            </>
          }
        />
        <div className="mb-8 flex justify-end">
            <button type="button" onClick={loadLeads} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition ${
                status === item
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="font-medium text-[var(--foreground)]">No leads found</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">New contact requests will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[var(--background)] text-left text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-6 py-3">Lead</th>
                    <th className="px-6 py-3">Offering</th>
                    <th className="px-6 py-3">Message</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="align-top hover:bg-[var(--background)]">
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--foreground)]">{lead.name}</div>
                        <a href={`mailto:${lead.email}`} className="text-[var(--primary)] hover:underline">{lead.email}</a>
                        {lead.company && <div className="text-xs text-[var(--muted-foreground)]">{lead.company}</div>}
                        {lead.phone && <div className="text-xs text-[var(--muted-foreground)]">{lead.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        {lead.offering ? (
                          <Link href={`/offerings/${lead.offering.slug}`} className="font-medium text-[var(--primary)] hover:underline">
                            {lead.offering.title}
                          </Link>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">Partner profile</span>
                        )}
                      </td>
                      <td className="max-w-md px-6 py-4 text-[var(--muted-foreground)]">{lead.message}</td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.status}
                          onChange={(event) => updateStatus(lead.id, event.target.value)}
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        >
                          {statuses.filter((item) => item !== "all").map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted-foreground)]">
                        {new Date(lead.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
    </DashboardShell>
  );
}
