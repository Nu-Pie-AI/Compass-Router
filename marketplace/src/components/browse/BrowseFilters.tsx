"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";

interface Category {
  id: string;
  slug: string;
  name: string;
  productCount: number;
}

interface BrowseFiltersProps {
  categories: Category[];
}

export function BrowseFilters({ categories }: BrowseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("category") || "";
  const selectedRating = searchParams.get("rating") || "";
  const selectedPricing = searchParams.get("pricing") || "";
  const selectedSort = searchParams.get("sort") || "name";

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    params.delete("page");

    router.push(`/browse?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/browse");
  };

  const hasActiveFilters = selectedCategory || selectedRating || selectedPricing;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 sticky top-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
          Sort By
        </h3>
        <select
          value={selectedSort}
          onChange={(e) => updateFilters("sort", e.target.value)}
          className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="popular">Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">Newest</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      {/* Categories */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
          Category
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="category"
              value=""
              checked={!selectedCategory}
              onChange={() => updateFilters("category", "")}
              className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
              All Categories
            </span>
          </label>
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center justify-between gap-2 cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="category"
                  value={category.slug}
                  checked={selectedCategory === category.slug}
                  onChange={(e) => updateFilters("category", e.target.value)}
                  className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
                  {category.name}
                </span>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {category.productCount}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
          Rating
        </h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="rating"
              value=""
              checked={!selectedRating}
              onChange={() => updateFilters("rating", "")}
              className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
              All Ratings
            </span>
          </label>
          {[4, 3, 2].map((rating) => (
            <label
              key={rating}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="radio"
                name="rating"
                value={rating.toString()}
                checked={selectedRating === rating.toString()}
                onChange={(e) => updateFilters("rating", e.target.value)}
                className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-[var(--secondary)] text-[var(--secondary)]" />
                <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
                  {rating}+ stars
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
          Pricing
        </h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="pricing"
              value=""
              checked={!selectedPricing}
              onChange={() => updateFilters("pricing", "")}
              className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
              All Pricing
            </span>
          </label>
          {["Free", "Freemium", "Paid"].map((pricing) => (
            <label
              key={pricing}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="radio"
                name="pricing"
                value={pricing}
                checked={selectedPricing === pricing}
                onChange={(e) => updateFilters("pricing", e.target.value)}
                className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)]">
                {pricing}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
