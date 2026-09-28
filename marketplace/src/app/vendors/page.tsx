import Link from "next/link";
import { CheckCircle, Users, TrendingUp, DollarSign } from "lucide-react";
import { redirect } from "next/navigation";

export default function VendorsLandingPage() {
  // Redirect to partners page - Vendor portal is hidden
  redirect('/partners');

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero Section */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] text-[var(--muted-foreground)] text-sm font-medium border border-[var(--border)] mb-6">
              <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></span>
              For Software Vendors
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-6">
              List Your Software Product on Nexus
            </h1>
            <p className="text-xl text-[var(--muted-foreground)] mb-8">
              Join thousands of software vendors reaching millions of potential customers.
              Showcase your product, get reviews, and grow your business.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/vendors/register"
                className="px-8 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-lg transition-colors"
              >
                Get Started for Free
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
            Why List Your Product on Nexus?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Reach More Customers</h3>
              <p className="text-[var(--muted-foreground)]">
                Get discovered by buyers actively searching for software solutions.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Build Credibility</h3>
              <p className="text-[var(--muted-foreground)]">
                Collect and showcase verified reviews from real users.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Capture Quality Leads</h3>
              <p className="text-[var(--muted-foreground)]">
                Get direct inquiries from interested prospects ready to buy.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-lg">
              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Easy to Get Started</h3>
              <p className="text-[var(--muted-foreground)]">
                List your product in minutes with our simple onboarding process.
              </p>
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
                Everything You Need to Showcase Your Product
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Comprehensive Product Profiles</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Showcase features, pricing, screenshots, and videos
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Review Management</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Respond to reviews and build trust with potential customers
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Lead Management Dashboard</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Track and manage all customer inquiries in one place
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] mb-1">Analytics & Insights</h4>
                    <p className="text-[var(--muted-foreground)]">
                      Track views, clicks, and engagement with your listings
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
            Ready to Grow Your Software Business?
          </h2>
          <p className="text-xl text-[var(--muted-foreground)] mb-8 max-w-2xl mx-auto">
            Join hundreds of software vendors already listing on Nexus.
            It's free to get started.
          </p>
          <Link
            href="/vendors/register"
            className="inline-block px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-lg rounded-lg transition-colors"
          >
            Create Your Vendor Account
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">10K+</div>
              <div className="text-[var(--muted-foreground)] font-medium">Active Products</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">1M+</div>
              <div className="text-[var(--muted-foreground)] font-medium">Monthly Visitors</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-[var(--foreground)] mb-2">50K+</div>
              <div className="text-[var(--muted-foreground)] font-medium">Verified Reviews</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
