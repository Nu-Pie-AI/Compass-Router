"use client";

import { useState } from "react";
import { ExternalLink, Mail, X } from "lucide-react";

interface OfferingActionsProps {
  slug: string;
  website?: string | null;
  offeringTitle: string;
  partnerName?: string | null;
}

interface ContactFormState {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
}

const initialFormState: ContactFormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  message: "",
};

async function trackClick(slug: string, clickType: string) {
  try {
    await fetch(`/api/offerings/${slug}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickType }),
      keepalive: true,
    });
  } catch {
    // Silent by design.
  }
}

export function OfferingActions({
  slug,
  website,
  offeringTitle,
  partnerName,
}: OfferingActionsProps) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const openContact = () => {
    trackClick(slug, "contact");
    setError("");
    setSuccess("");
    setForm((current) => ({
      ...current,
      message:
        current.message ||
        `Hi, I would like to learn more about ${offeringTitle}.`,
    }));
    setIsContactOpen(true);
  };

  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/offerings/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send your message");
      }

      setSuccess(data.message || "Your message has been sent.");
      setForm(initialFormState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send your message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick(slug, "website")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            Visit Website
          </a>
        )}

        <button
          type="button"
          onClick={openContact}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-3 font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)]"
        >
          <Mail className="h-4 w-4" />
          Contact Partner
        </button>
      </div>

      {isContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-[var(--surface)] shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">
                  Contact {partnerName || "Partner"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Ask about pricing, implementation, fit, or next steps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="rounded-md p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                aria-label="Close contact form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitContact} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Name
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </label>
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Company
                  <input
                    value={form.company}
                    onChange={(event) => setForm({ ...form, company: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </label>
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-[var(--foreground)]">
                Message
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  required
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </label>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
