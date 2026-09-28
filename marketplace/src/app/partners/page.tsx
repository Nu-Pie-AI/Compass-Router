import Link from "next/link";
import { CheckCircle, Users, TrendingUp, DollarSign } from "lucide-react";

export default function PartnersLandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero Section */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] text-[var(--muted-foreground)] text-sm font-medium border border-[var(--border)] mb-6">
              <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></span>
              For Solution Partners
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-6">
              List Your Solutions on Compass
            </h1>
            <p className="text-xl text-[var(--muted-foreground)] mb-8">
              Join innovative partners reaching millions of SMBs. Showcase your products, services,
              and expertise to businesses actively seeking solutions.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/partners/register"
                className="px-8 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-lg transition-colors"
              >
                Become a Partner
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 border border-[var(--border)] hover:bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-lg transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[var(--foreground)] text-center mb-12">
            Why Partner with Compass?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Reach SMBs at Scale</h3>
              <p className="text-[var(--muted-foreground)]">
                Connect with thousands of small and medium businesses actively searching for solutions.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Build Your Reputation</h3>
              <p className="text-[var(--muted-foreground)]">
                Showcase your expertise with case studies, reviews, and verified customer success stories.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Generate Quality Leads</h3>
              <p className="text-[var(--muted-foreground)]">
                Receive direct inquiries from businesses ready to invest in your solutions.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Quick Onboarding</h3>
              <p className="text-[var(--muted-foreground)]">
                Get listed in minutes with our AI-assisted onboarding that extracts data from your website.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Types Section */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--foreground)] mb-4">
              Who Can Partner with Us?
            </h2>
            <p className="text-lg text-[var(--muted-foreground)]">
              We welcome all types of solution providers serving the SMB market
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3">Software Vendors</h3>
              <p className="text-[var(--muted-foreground)] mb-4">
                SaaS products, enterprise software, mobile apps, and cloud platforms designed for SMBs.
              </p>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>CRM, ERP, Accounting software</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Marketing & Sales tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Operations & Productivity apps</span>
                </li>
              </ul>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3">Service Providers</h3>
              <p className="text-[var(--muted-foreground)] mb-4">
                Professional services, consulting, implementation, and managed services for SMBs.
              </p>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Business consulting & advisory</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Implementation & integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Training & support services</span>
                </li>
              </ul>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3">System Integrators</h3>
              <p className="text-[var(--muted-foreground)] mb-4">
                Technology integration specialists helping SMBs adopt and optimize digital solutions.
              </p>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Digital transformation experts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Cloud migration & setup</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Custom integrations & APIs</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[var(--foreground)] mb-6">
                Everything You Need to Showcase Your Offerings
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">AI-Powered Onboarding</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Our AI extracts offering details from your website in seconds
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Comprehensive Profiles</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Showcase use cases, pain points solved, integrations, and customer testimonials
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Lead Management Dashboard</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Track inquiries, manage contacts, and measure engagement
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Analytics & Insights</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Track views, clicks, and performance with detailed analytics
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] p-8 rounded-2xl">
              <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[var(--primary)] rounded"></div>
                  <div>
                    <div className="h-3 bg-[var(--background)] rounded w-24 mb-1"></div>
                    <div className="h-2 bg-[var(--background)] rounded w-16"></div>
                  </div>
                </div>
                <div className="h-2 bg-[var(--background)] rounded w-full mb-2"></div>
                <div className="h-2 bg-[var(--background)] rounded w-3/4"></div>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[var(--primary)] rounded"></div>
                  <div>
                    <div className="h-3 bg-[var(--background)] rounded w-24 mb-1"></div>
                    <div className="h-2 bg-[var(--background)] rounded w-16"></div>
                  </div>
                </div>
                <div className="h-2 bg-[var(--background)] rounded w-full mb-2"></div>
                <div className="h-2 bg-[var(--background)] rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-[var(--foreground)] mb-4">
            Ready to Grow Your Business?
          </h2>
          <p className="text-xl text-[var(--muted-foreground)] mb-8 max-w-2xl mx-auto">
            Be part of the community of partners already connecting with SMBs on Compass.
            It's free to get started.
          </p>
          <Link
            href="/partners/register"
            className="inline-block px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-lg rounded-lg transition-colors"
          >
            Create Your Partner Account
          </Link>
        </div>
      </section>

      {/* Stats Section 
      <section className="py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">500+</div>
              <div className="text-[var(--muted-foreground)] font-medium">Active Partners</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">50K+</div>
              <div className="text-[var(--muted-foreground)] font-medium">SMB Customers</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">10K+</div>
              <div className="text-[var(--muted-foreground)] font-medium">Successful Matches</div>
            </div>
          </div>
        </div>
      </section>
      */}
    </div>
  );
}
