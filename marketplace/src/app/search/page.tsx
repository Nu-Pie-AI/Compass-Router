import { redirect } from "next/navigation";
import { OfferingCard } from "@/components/ui/OfferingCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { Search } from "lucide-react";
import Link from "next/link";
import { getApiUrl } from "@/lib/api-url";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function searchOfferings(query: string) {
  const res = await fetch(getApiUrl("api/search"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Search failed");
  }

  return res.json();
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim();

  // Redirect to browse if no query
  if (!query) {
    redirect("/browse");
  }

  const searchData = await searchOfferings(query);
  const results = searchData.data || [];

  return (
    <div className="min-h-screen bg-[var(--background)] pt-4">
      <div className="container mx-auto px-4 py-12">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">
            Search Results
          </h1>

          {/* Search Bar */}
          <div className="max-w-2xl">
            <SearchBar defaultValue={query} placeholder="Search for solutions..." />
          </div>
        </div>

        {/* Search Query & Results Count */}
        <div className="mb-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            {results.length > 0 ? (
              <>
                Found <span className="font-semibold text-[var(--foreground)]">{results.length}</span>{" "}
                {results.length === 1 ? "result" : "results"} for{" "}
                <span className="font-semibold text-[var(--foreground)]">"{query}"</span>
              </>
            ) : (
              <>
                No results found for{" "}
                <span className="font-semibold text-[var(--foreground)]">"{query}"</span>
              </>
            )}
          </p>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((result: any) => {
              const offering = result.offering;
              return (
                <div key={offering.id} className="relative">
                  <OfferingCard
                    slug={offering.slug}
                    title={offering.title}
                    logo={offering.logo}
                    shortDescription={offering.shortDescription}
                    averageRating={offering.averageRating}
                    reviewCount={offering.reviewCount}
                    pricingModel={offering.pricingModel}
                    startingPrice={offering.startingPrice}
                    categories={offering.categories}
                    featured={offering.featured}
                    offeringType={offering.offeringType}
                  />
                  {/* Relevance Score */}
                  {result.relevance && (
                    <div className="absolute top-3 left-3 bg-[var(--surface)]/95 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-[var(--foreground)] border border-[var(--border)]">
                      {Math.round(result.relevance * 100)}% match
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--background)] mb-4">
              <Search className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
              No results found
            </h2>
            <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
              We couldn't find any offerings matching "{query}". Try different keywords or browse our catalog.
            </p>

            {/* Search Tips */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-lg mx-auto mb-6 text-left">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                Search tips:
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>• Try more general keywords (e.g., "CRM" instead of "customer relationship")</li>
                <li>• Check your spelling</li>
                <li>• Try searching by category (e.g., "project management", "marketing")</li>
                <li>• Use fewer keywords</li>
              </ul>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/browse"
                className="px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors"
              >
                Browse All Offerings
              </Link>
              <Link
                href="/categories"
                className="px-6 py-3 border border-[var(--border)] hover:bg-[var(--background)] text-[var(--foreground)] rounded-lg font-medium transition-colors"
              >
                Browse Categories
              </Link>
            </div>
          </div>
        )}

        {/* Suggested Actions for Results */}
        {results.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Didn't find what you were looking for?
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/browse"
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Browse all offerings
              </Link>
              <span className="text-[var(--muted-foreground)]">•</span>
              <Link
                href="/categories"
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Explore by category
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
