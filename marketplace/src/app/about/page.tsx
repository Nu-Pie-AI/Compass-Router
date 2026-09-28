import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Compass",
  description:
    "Learn about Compass and our mission to help businesses discover, compare, and choose the right technology solutions with confidence.",
  openGraph: {
    title: "About Us | Compass",
    description:
      "Learn about Compass and our mission to help businesses discover the right technology solutions.",
    type: "website",
  },
};

const values = [
  {
    title: "Transparency",
    description:
      "We prioritize clear information, straightforward comparisons, and honest context so teams can evaluate options without unnecessary friction.",
    icon: ShieldCheck,
  },
  {
    title: "Trust",
    description:
      "We want Compass to feel dependable at every step, from discovery and reviews to the signals buyers use to shortlist vendors.",
    icon: Users,
  },
  {
    title: "Practical Innovation",
    description:
      "We use AI and modern product design where they genuinely help people move faster and make better decisions.",
    icon: Sparkles,
  },
];

const buyerBenefits = [
  "Discover solutions across meaningful business categories",
  "Compare features, positioning, and fit more efficiently",
  "Use AI-assisted guidance to narrow options with confidence",
  "Reduce the time spent bouncing between vendor sites and sales calls",
];

const vendorBenefits = [
  "Showcase offerings to buyers who are actively researching",
  "Present capabilities in a structured, easier-to-evaluate format",
  "Build trust through stronger marketplace visibility and context",
  "Reach customers earlier in their decision journey",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-ambient sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,188,101,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(55,114,255,0.14),transparent_32%)] pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)]">
              <Compass className="h-4 w-4 text-[var(--primary)]" />
              About Compass
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Helping teams discover the right software and services with more clarity
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              Compass is built for businesses that want better technology
              decisions without the noise. We bring together discovery,
              comparison, and guided evaluation so buyers can move faster and
              vendors can present their value more clearly.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Our mission
            </h2>
            <div className="mt-4 space-y-4 text-[var(--muted-foreground)]">
              <p>
                Our mission is to make software and solution selection more
                informed, more transparent, and less overwhelming for growing
                businesses.
              </p>
              <p>
                Too often, teams are forced to assemble buying context from
                scattered websites, inconsistent pricing details, generic vendor
                claims, and disconnected review sources. Compass brings that
                decision-making process into one clearer experience.
              </p>
              <p>
                We want every business, regardless of size, to have access to
                the information and guidance needed to choose tools that match
                their goals, budget, and operational reality.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.12),rgba(55,114,255,0.12))] p-6 shadow-ambient sm:p-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              What Compass is designed to do
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
              <li>Turn broad research into a more focused shortlist.</li>
              <li>Help buyers compare solutions with better context.</li>
              <li>Support vendors in presenting real business value.</li>
              <li>Create a marketplace experience that feels practical, not noisy.</li>
            </ul>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              For buyers
            </h2>
            <ul className="mt-5 space-y-3 text-[var(--muted-foreground)]">
              {buyerBenefits.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              For partners
            </h2>
            <ul className="mt-5 space-y-3 text-[var(--muted-foreground)]">
              {vendorBenefits.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">
            The principles behind the platform
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                    <Icon className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-ambient sm:p-10">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
            Ready to explore with more confidence?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--muted-foreground)]">
            Browse the marketplace, compare categories, or start with the AI
            Advisor to get pointed in the right direction.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/browse">
              <Button variant="primary" size="lg">
                Browse Solutions
              </Button>
            </Link>
            <Link href="/ai-advisor-chat">
              <Button variant="outline" size="lg">
                Talk to AI Advisor
              </Button>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]"
            >
              Contact our team
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
