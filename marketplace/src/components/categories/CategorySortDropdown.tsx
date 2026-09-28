"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface CategorySortDropdownProps {
  defaultSort: string;
}

export function CategorySortDropdown({ defaultSort }: CategorySortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <select
      name="sort"
      defaultValue={defaultSort}
      onChange={(e) => handleSortChange(e.target.value)}
      className="border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
    >
      <option value="popular">Most Popular</option>
      <option value="rating">Highest Rated</option>
      <option value="newest">Newest</option>
      <option value="name">Name (A-Z)</option>
    </select>
  );
}
