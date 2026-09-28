import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { Clock, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Compass",
  description:
    "Get in touch with the Compass team. We're here to help with any questions about our marketplace, support inquiries, or partnership opportunities.",
  openGraph: {
    title: "Contact Us | Compass",
    description:
      "Get in touch with the Compass team for support or partnership inquiries.",
    type: "website",
  },
};

const contactWays = [
  {
    title: "Email",
    description: "General questions, support, partnerships, and marketplace inquiries.",
    value: "hello@nu-pie.com",
    href: "mailto:hello@nu-pie.com",
    icon: Mail,
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-ambient sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,188,101,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(55,114,255,0.14),transparent_32%)] pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)]">
              <Mail className="h-4 w-4 text-[var(--primary)]" />
              Contact Compass
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Reach out when you need support, guidance, or partnership help
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              Whether you are exploring solutions, listing an offering, or just
              trying to understand how Compass can help, we are happy to point
              you in the right direction.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                Get in touch
              </h2>
              <div className="mt-6 space-y-4">
                {contactWays.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                          <Icon className="h-5 w-5 text-[var(--primary)]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--foreground)]">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">
                            {item.description}
                          </p>
                          <a
                            href={item.href}
                            className="mt-2 inline-block text-sm font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]"
                          >
                            {item.value}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--secondary)]/10">
                  <Clock className="h-5 w-5 text-[var(--secondary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Response time
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    We typically respond within 24 hours on business days.
                    Compass currently operates as a remote-first team serving
                    businesses across regions and time zones.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                  <MapPin className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    Location
                  </h3>
                  <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">
                    Remote-first team
                    <br />
                    Supporting businesses worldwide
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.12),rgba(55,114,255,0.12))] p-6 shadow-ambient">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Quick links
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-sm font-medium">
                <Link href="/about" className="text-[var(--foreground)] hover:text-[var(--primary)]">
                  Learn more about Compass
                </Link>
                <Link href="/browse" className="text-[var(--foreground)] hover:text-[var(--primary)]">
                  Browse solutions
                </Link>
                <Link href="/partners" className="text-[var(--foreground)] hover:text-[var(--primary)]">
                  Explore partnership options
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Send us a message
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              Share a few details and we will follow up with the most helpful next step.
            </p>
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 sm:p-6">
              <ContactForm />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
