import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Compass",
  description:
    "Read the Terms of Service for using the Compass marketplace platform. Learn about user responsibilities, vendor guidelines, and platform policies.",
  openGraph: {
    title: "Terms of Service | Compass",
    description:
      "Terms of Service and usage guidelines for the Compass marketplace platform.",
    type: "website",
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-ambient sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,188,101,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(55,114,255,0.14),transparent_32%)] pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)]">
              <Scale className="h-4 w-4 text-[var(--primary)]" />
              Platform terms and usage rules
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              These terms explain the rules, responsibilities, and legal
              expectations for using the Compass platform.
            </p>
            <p className="mt-4 text-sm font-medium text-[var(--muted-foreground)]">
              Last Updated: March 5, 2026
            </p>
          </div>
        </section>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                On this page
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-[var(--muted-foreground)]">
                <li>Using the platform</li>
                <li>Vendor listings and reviews</li>
                <li>Payments and subscriptions</li>
                <li>Intellectual property</li>
                <li>Termination and liability</li>
                <li>Contact information</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.12),rgba(55,114,255,0.12))] p-6 shadow-ambient">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                  <FileText className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Need clarification?
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    Contact{" "}
                    <a
                      href="mailto:hello@nu-pie.com"
                      className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]"
                    >
                      hello@nu-pie.com
                    </a>{" "}
                    or visit{" "}
                    <Link
                      href="/contact"
                      className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]"
                    >
                      /contact
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-ambient sm:p-8">
            <div className="space-y-10">
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 sm:p-6">
                <p className="leading-8 text-[var(--muted-foreground)]">
                  Welcome to Compass. These Terms of Service govern your use of
                  the Compass marketplace platform. By accessing or using the
                  platform, you agree to be bound by these terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">1. Acceptance of Terms</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  By creating an account, accessing, or using any part of the platform, you agree to comply with and be legally bound by these Terms, our Privacy Policy, and all applicable laws and regulations.
                </p>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  If you use the platform on behalf of an organization, you represent that you have the authority to bind that organization to these terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">2. Use of Platform</h2>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">Permitted Uses</h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Browse and search for software solutions and services</li>
                  <li>Read and compare vendor listings, reviews, and ratings</li>
                  <li>Create an account and manage your profile</li>
                  <li>Submit reviews and feedback about solutions you have used</li>
                  <li>Contact vendors through the platform</li>
                  <li>Use our AI Advisor to receive personalized recommendations</li>
                </ul>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">Prohibited Activities</h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Violate applicable laws, regulations, or third-party rights</li>
                  <li>Submit false, misleading, or fraudulent information or reviews</li>
                  <li>Attempt unauthorized access to the platform or other accounts</li>
                  <li>Interfere with platform operations or infrastructure</li>
                  <li>Use bots or scrapers without permission</li>
                  <li>Harvest personal information about other users</li>
                  <li>Post spam, malware, or malicious code</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">3. Vendor Listings</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  Compass provides a platform for vendors to list their software solutions and services. We strive to verify vendor information, but we do not guarantee the accuracy, completeness, or quality of any vendor listing.
                </p>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">Vendor Responsibilities</h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Maintain accurate pricing, feature, and description details</li>
                  <li>Honor the terms and services described in listings</li>
                  <li>Comply with applicable laws and regulations</li>
                  <li>Handle their own support and customer service obligations</li>
                </ul>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">Buyer Responsibilities</h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Conduct independent due diligence before making purchases</li>
                  <li>Review vendor terms before entering into agreements</li>
                  <li>Understand that Compass is not a party to vendor transactions</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">4. Reviews and User Content</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  By submitting reviews, ratings, or other content, you grant Compass a non-exclusive, worldwide, royalty-free license to use, display, and distribute that content on the platform.
                </p>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li>Reviews must reflect genuine experience</li>
                  <li>Reviews must be honest, accurate, and not misleading</li>
                  <li>Reviews must not contain abuse, hate speech, or discriminatory language</li>
                  <li>Reviews must not include personal information about others without consent</li>
                  <li>Reviews submitted for compensation must be disclosed where applicable</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">5. Intellectual Property</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  The platform and its core content, features, and functionality are owned by Compass and protected by applicable intellectual property laws.
                </p>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  You retain ownership of content you submit, but you grant us the right to use and display it in connection with the platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">6. Payment and Subscriptions</h2>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li>You agree to provide accurate billing information</li>
                  <li>You authorize charges for applicable fees incurred</li>
                  <li>Fees are non-refundable unless otherwise stated</li>
                  <li>We may change pricing with advance notice</li>
                  <li>Non-payment may result in suspension or termination</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">7. Disclaimer of Warranties</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  The platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, including implied warranties of merchantability, fitness for a particular purpose, non-infringement, or uninterrupted availability.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">8. Limitation of Liability</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  To the fullest extent permitted by law, Compass shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, revenues, goodwill, data, or similar losses.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">9. Account Termination</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  You may terminate your account by contacting{" "}
                  <a href="mailto:hello@nu-pie.com" className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]">
                    hello@nu-pie.com
                  </a>
                  . We may suspend or terminate accounts for violations of these terms, fraud, non-payment, abusive conduct, or other reasons at our discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">10. Changes to Terms</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We may modify these Terms at any time. Material changes may be communicated by email or through notices on the platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">11. Governing Law</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  These Terms shall be governed by the laws of the applicable jurisdiction referenced by Compass, without regard to conflict of law principles.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">12. Contact Information</h2>
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <ul className="space-y-3 text-[var(--muted-foreground)]">
                    <li><strong>Email:</strong> <a href="mailto:hello@nu-pie.com" className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]">hello@nu-pie.com</a></li>
                    <li><strong>Contact Page:</strong> <Link href="/contact" className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]">/contact</Link></li>
                  </ul>
                </div>
              </section>

              <div className="border-t border-[var(--border)] pt-6">
                <p className="text-sm italic text-[var(--muted-foreground)]">
                  This Terms of Service document is provided for informational purposes and should be reviewed and customized by legal counsel before production use.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
