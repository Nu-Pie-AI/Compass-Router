import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Blog | Compass",
  description:
    "Insights, guides, and practical advice from Compass to help teams evaluate software, compare vendors, and make smarter technology decisions.",
  openGraph: {
    title: "Blog | Compass",
    description:
      "Insights, guides, and practical advice to help teams choose the right technology solutions.",
    type: "website",
  },
};

const featuredPosts = [
  {
    title: "How to Evaluate Business Software Without Getting Overwhelmed",
    description:
      "A simple framework for narrowing options, aligning stakeholders, and choosing tools with confidence.",
    category: "Buying Guides",
    readTime: "6 min read",
  },
  {
    title: "What SMB Teams Should Look For Before Contacting a Vendor",
    description:
      "The questions worth answering internally before demos, trials, pricing calls, and procurement reviews.",
    category: "Vendor Evaluation",
    readTime: "5 min read",
  },
  {
    title: "Using AI to Shortlist Solutions Faster and More Reliably",
    description:
      "Where AI helps in software discovery, where it does not, and how to use it as a decision support tool.",
    category: "AI Advisor",
    readTime: "7 min read",
  },
];

const topics = [
  "Software buying checklists",
  "Category comparison guides",
  "Vendor selection best practices",
  "Marketplace updates and product news",
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-ambient sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,188,101,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(55,114,255,0.14),transparent_34%)] pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              Compass Insights
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Practical buying advice for teams choosing software and services
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              The Compass Blog shares decision frameworks, category insights,
              vendor evaluation tips, and marketplace updates to help businesses
              move from research to confident action.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/browse">
                <Button variant="primary" size="lg">
                  Browse Solutions
                </Button>
              </Link>
              <Link href="/ai-advisor-chat">
                <Button variant="outline" size="lg">
                  Ask the AI Advisor
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
              <BookOpen className="h-4 w-4" />
              Featured Articles
            </div>
            <div className="mt-6 space-y-5">
              {featuredPosts.map((post) => (
                <article
                  key={post.title}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
                    <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 font-medium text-[var(--primary)]">
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                    {post.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-[var(--muted-foreground)]">
                    {post.description}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--secondary)]">
                    Content coming soon
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                What you will find here
              </h2>
              <ul className="mt-4 space-y-3">
                {topics.map((topic) => (
                  <li
                    key={topic}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.12),rgba(55,114,255,0.12))] p-6 shadow-ambient">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Looking for answers right now?
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                If you are actively evaluating tools, you do not need to wait
                for the next article. Browse categories or describe your use
                case to the AI Advisor and get tailored recommendations.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/categories"
                  className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Explore categories
                </Link>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Contact the Compass team
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
