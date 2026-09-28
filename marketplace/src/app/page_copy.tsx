import { Search } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-20">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            Powered by AI
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[var(--foreground)] tracking-tight">
            Discover the perfect{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-800">
              software
            </span>{" "}
            for your business
          </h1>

          {/* Value Proposition */}
          <p className="text-xl sm:text-2xl text-[var(--muted-foreground)] max-w-3xl mx-auto leading-relaxed">
            AI-powered search that understands your needs. Find, compare, and choose
            the best tools for your team in seconds.
          </p>

          {/* Search Input */}
          <div className="max-w-2xl mx-auto pt-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative flex items-center bg-[var(--surface)] border-2 border-[var(--border)] rounded-2xl shadow-lg hover:border-indigo-300 focus-within:border-indigo-500 transition-all">
                <Search className="absolute left-6 w-5 h-5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Search for CRM, project management, analytics..."
                  className="w-full pl-14 pr-6 py-5 text-lg bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                  disabled
                />
                <button
                  className="absolute right-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled
                >
                  Search
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Try: &quot;CRM for small teams&quot; or &quot;Free project management tools&quot;
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--foreground)]">1,000+</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Software Products</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--foreground)]">50+</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--foreground)]">10k+</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Reviews</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-[var(--border)]">
        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">AI-Powered Search</h3>
            <p className="text-[var(--muted-foreground)]">
              Semantic search that understands intent, not just keywords
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">Verified Reviews</h3>
            <p className="text-[var(--muted-foreground)]">
              Real feedback from verified users and industry experts
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">Save Time</h3>
            <p className="text-[var(--muted-foreground)]">
              Compare pricing, features, and reviews in one place
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
