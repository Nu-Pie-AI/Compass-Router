import Link from "next/link";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--background)] mb-6">
          <Search className="w-8 h-8 text-[var(--muted-foreground)]" />
        </div>

        <h1 className="text-6xl font-bold text-[var(--foreground)] mb-3">404</h1>

        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-3">
          Page not found
        </h2>

        <p className="text-[var(--muted-foreground)] mb-8">
          Sorry, we couldn't find the page you're looking for. It may have been moved or
          deleted.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/browse"
            className="px-6 py-3 border border-[var(--border)] hover:bg-[var(--background)] text-[var(--foreground)] font-medium rounded-lg transition-colors"
          >
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
