import Link from "next/link";
import type { Metadata } from "next";
import { Lock, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Compass",
  description:
    "Learn how Compass collects, uses, and protects your personal information. Our commitment to your privacy and data security.",
  openGraph: {
    title: "Privacy Policy | Compass",
    description:
      "Learn about Compass's privacy practices and data protection policies.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-ambient sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,188,101,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(55,114,255,0.12),transparent_32%)] pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)]">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              Privacy and data protection
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              This page explains how Compass collects, uses, shares, and protects
              information when you use the platform.
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
                <li>Information we collect</li>
                <li>How we use information</li>
                <li>Sharing and disclosure</li>
                <li>Cookies and security</li>
                <li>Your rights and choices</li>
                <li>How to contact us</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(77,188,101,0.12),rgba(55,114,255,0.12))] p-6 shadow-ambient">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                  <Lock className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Questions about privacy?
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    Reach out at{" "}
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
                      our contact page
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
                  At Compass, we are committed to protecting your privacy and
                  ensuring the security of your personal information. This Privacy
                  Policy explains how we collect, use, disclose, and safeguard your
                  information when you use our marketplace platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  1. Information We Collect
                </h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We collect information that you provide directly to us, as well
                  as information that is automatically collected when you use our
                  platform.
                </p>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                  Information You Provide
                </h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Account information: name, email address, password, and profile details</li>
                  <li>Company information: company name, size, and industry</li>
                  <li>Communication data: messages, reviews, and inquiries submitted through our platform</li>
                  <li>Payment information: billing details for vendor accounts</li>
                </ul>
                <h3 className="mt-6 text-lg font-semibold text-[var(--foreground)]">
                  Automatically Collected Information
                </h3>
                <ul className="mt-3 space-y-3 text-[var(--muted-foreground)]">
                  <li>Usage data: pages viewed, features used, search queries, and time spent on platform</li>
                  <li>Device information: IP address, browser type, operating system, and device identifiers</li>
                  <li>Location data: general geographic location based on IP address</li>
                  <li>Cookies and tracking technologies: preferences, session data, and analytics</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  2. How We Use Information
                </h2>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li><strong>Provide and improve our services:</strong> To operate and maintain the Compass marketplace, process transactions, and enhance user experience</li>
                  <li><strong>Personalization:</strong> To provide personalized recommendations and content based on your interests and usage patterns</li>
                  <li><strong>Communication:</strong> To send you updates, notifications, marketing communications, and respond to your inquiries</li>
                  <li><strong>Analytics and research:</strong> To understand how users interact with our platform and improve our services</li>
                  <li><strong>Security and fraud prevention:</strong> To protect our platform, users, and vendors from fraudulent or malicious activity</li>
                  <li><strong>Legal compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  3. Data Sharing and Disclosure
                </h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We do not sell your personal information. We may share your
                  information in the following circumstances:
                </p>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li><strong>Service providers:</strong> Third-party vendors who provide services such as hosting, analytics, payment processing, and customer support</li>
                  <li><strong>Vendors on our platform:</strong> When you interact with a vendor listing or submit an inquiry, we share relevant information to facilitate the connection</li>
                  <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  <li><strong>Legal requirements:</strong> When required by law, court order, or government authority</li>
                  <li><strong>Protection of rights:</strong> To protect the rights, property, or safety of Compass, our users, or the public</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  4. Data Security
                </h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We implement industry-standard security measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction.
                </p>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and vulnerability testing</li>
                  <li>Access controls and authentication requirements</li>
                  <li>Employee training on data protection and privacy</li>
                  <li>Monitoring and logging of system activity</li>
                </ul>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  5. Cookies and Tracking Technologies
                </h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We use cookies and similar tracking technologies to collect and store information about your preferences and usage patterns.
                </p>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li><strong>Essential cookies:</strong> Required for the platform to function properly</li>
                  <li><strong>Analytics cookies:</strong> Help us understand how users interact with our platform</li>
                  <li><strong>Preference cookies:</strong> Remember your settings and preferences</li>
                  <li><strong>Marketing cookies:</strong> Used to deliver relevant advertisements and track campaign effectiveness</li>
                </ul>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  You can control cookie preferences through your browser settings. Disabling certain cookies may limit some platform features.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  6. Your Rights and Choices
                </h2>
                <ul className="mt-4 space-y-3 text-[var(--muted-foreground)]">
                  <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal obligations</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from marketing communications at any time</li>
                  <li><strong>Data portability:</strong> Request a copy of your data in a machine-readable format</li>
                  <li><strong>Objection:</strong> Object to certain types of processing of your personal information</li>
                </ul>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  To exercise these rights, contact{" "}
                  <a href="mailto:hello@nu-pie.com" className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]">
                    hello@nu-pie.com
                  </a>
                  . We will respond within 30 days.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">7. Data Retention</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">8. Children&apos;s Privacy</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  Our platform is not intended for children under the age of 18. We do not knowingly collect personal information from children.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">9. Changes to This Privacy Policy</h2>
                <p className="mt-4 leading-8 text-[var(--muted-foreground)]">
                  We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We encourage you to review this page periodically.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">10. Contact Us</h2>
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <ul className="space-y-3 text-[var(--muted-foreground)]">
                    <li><strong>Email:</strong> <a href="mailto:hello@nu-pie.com" className="font-medium text-[var(--secondary)] hover:text-[var(--secondary-dark)]">hello@nu-pie.com</a></li>
                  </ul>
                </div>
              </section>

              <div className="border-t border-[var(--border)] pt-6">
                <p className="text-sm italic text-[var(--muted-foreground)]">
                  This Privacy Policy is provided for informational purposes and should be reviewed by legal counsel before use in production.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
