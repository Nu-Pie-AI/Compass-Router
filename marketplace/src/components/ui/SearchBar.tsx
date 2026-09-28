"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, TrendingUp } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function SearchBar({
  placeholder = "Search for solutions...",
  defaultValue = "",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [trending, setTrending] = useState<string[]>([]);
  const router = useRouter();

  // Fetch trending searches on mount
  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/search/trending?limit=8");
        const data = await res.json();
        setTrending(data.data.map((t: any) => t.query));
      } catch (error) {
        console.error("Failed to fetch trending searches:", error);
      }
    }
    fetchTrending();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target?.closest(".search-bar-container")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    // Reset loading state after navigation
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleClear = () => {
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  const handleFocus = () => {
    if (!query && trending.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleTrendingClick = (term: string) => {
    setQuery(term);
    setShowDropdown(false);
    setIsLoading(true);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <form onSubmit={handleSubmit} className={`relative search-bar-container ${className}`}>
      {/* Search Icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Search className="w-5 h-5" />
        )}
      </div>

      {/* Input */}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value) {
            setShowDropdown(false);
          }
        }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-12 pr-30 py-3 glass-panel rounded-xl shadow-ambient focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        aria-label="Search for solutions"
        disabled={isLoading}
      />

      {/* Clear Button */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-22 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Clear search"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!query.trim() || isLoading}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Submit search"
      >
        Search
      </button>

      {/* Trending Searches Dropdown */}
      {showDropdown && trending.length > 0 && !query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-[var(--muted-foreground)] px-3 py-2 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              Trending Searches
            </div>
            <div className="space-y-1">
              {trending.map((term, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleTrendingClick(term)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--background)] rounded transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
