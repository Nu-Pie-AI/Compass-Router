import { Suspense } from "react";
import { OfferingCard } from "@/components/ui/OfferingCard";
import { BrowseFilters } from "@/components/browse/BrowseFilters";
import { PaginationControls } from "@/components/browse/PaginationControls";
import { getApiUrl } from "@/lib/api-url";

interface SearchParams {
  page?: string;
  category?: string;
  rating?: string;
  pricing?: string;
  sort?: string;
}

interface BrowsePageProps {
  searchParams: Promise<SearchParams>;
}

async function getOfferings(params: SearchParams) {
  const pageNumber = Number(params.page);
  const safePage = !pageNumber || pageNumber < 1 ? 1 : pageNumber;

  const searchParams = new URLSearchParams({
    page: safePage.toString(),
    limit: "12",
    ...(params.category && { category: params.category }),
    ...(params.rating && { minRating: params.rating }),
    ...(params.pricing && { pricingModel: params.pricing }),
    sort: params.sort || "name",
  });

  const res = await fetch(
    getApiUrl(`api/offerings?${searchParams}`),
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch offerings");
  }

  return res.json();
}

async function getCategories() {
  const res = await fetch(getApiUrl("api/categories"), {
    next: { revalidate: 86400 } // Cache for 24 hours (categories rarely change)
  });

  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }

  return res.json();
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;

  const [offeringsData, categoriesData] = await Promise.all([
    getOfferings(params),
    getCategories(),
  ]);

  const offerings = Array.isArray(offeringsData?.data)
    ? offeringsData.data
    : [];

  const rawMeta = offeringsData?.meta ?? {};

  const totalItems =
    typeof rawMeta.totalItems === "number" ? rawMeta.totalItems : 0;

  const currentPage =
    typeof rawMeta.currentPage === "number" && rawMeta.currentPage > 0
      ? rawMeta.currentPage
      : 1;

  const itemsPerPage =
    typeof rawMeta.itemsPerPage === "number" && rawMeta.itemsPerPage > 0
      ? rawMeta.itemsPerPage
      : 12;

  const totalPages =
    typeof rawMeta.totalPages === "number" && rawMeta.totalPages > 0
      ? rawMeta.totalPages
      : 1;

  const categories = Array.isArray(categoriesData?.data)
    ? categoriesData.data
        .filter((c: any) => c.productCount > 0)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [];

  const startItem =
    offerings.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;

  const endItem =
    offerings.length > 0
      ? Math.min(currentPage * itemsPerPage, totalItems)
      : 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-3">
            Browse Offerings
          </h1>
          <p className="text-lg text-[var(--muted-foreground)]">
            Discover the perfect solutions for your business from {totalItems} offerings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Suspense fallback={<div>Loading filters...</div>}>
              <BrowseFilters categories={categories} />
            </Suspense>
          </aside>

          {/* Offerings Grid */}
          <main className="lg:col-span-3">
            {/* Results Count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[var(--muted-foreground)]">
                Showing {startItem}-{endItem} of {totalItems} offerings
              </p>
            </div>

            {/* Offerings Grid */}
            {offerings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {offerings.map((offering: any) => (
                  <OfferingCard
                    key={offering.id}
                    slug={offering.slug}
                    title={offering.title}
                    logo={offering.logo}
                    shortDescription={offering.shortDescription}
                    averageRating={offering.averageRating}
                    reviewCount={offering.reviewCount}
                    pricingModel={offering.pricingModel}
                    startingPrice={offering.startingPrice}
                    categories={offering.categories ?? []}
                    featured={offering.featured}
                    offeringType={offering.offeringType}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-lg text-[var(--muted-foreground)] mb-4">
                  No offerings found matching your filters
                </p>
                <a
                  href="/browse"
                  className="text-[var(--primary)] hover:underline"
                >
                  Clear all filters
                </a>
              </div>
            )}

            {/* Pagination */}
            {offerings.length > 0 && totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
