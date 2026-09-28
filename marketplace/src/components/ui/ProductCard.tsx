import Link from "next/link";
import Image from "next/image";
import { StarRating } from "./StarRating";
import { Badge } from "./Badge";

interface ProductCardProps {
  slug: string;
  name: string;
  logo?: string;
  shortDescription?: string;
  averageRating: number;
  reviewCount: number;
  pricingModel?: string;
  startingPrice?: number;
  categories?: { slug: string; name: string }[];
  featured?: boolean;
}

export function ProductCard({
  slug,
  name,
  logo,
  shortDescription,
  averageRating,
  reviewCount,
  pricingModel,
  startingPrice,
  categories = [],
  featured = false,
}: ProductCardProps) {
  // Format pricing display
  const getPricingDisplay = () => {
    if (pricingModel === "Free" || startingPrice === 0) {
      return "Free";
    }
    if (startingPrice) {
      return `From $${startingPrice}/mo`;
    }
    return pricingModel || "Contact for pricing";
  };

  // Get first letter for fallback logo
  const getInitials = (text: string) => {
    return text.charAt(0).toUpperCase();
  };

  return (
    <Link
      href={`/products/${slug}`}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 block"
    >
      {/* Featured Badge */}
      {featured && (
        <div className="absolute top-3 right-3">
          <Badge variant="primary">Featured</Badge>
        </div>
      )}

      {/* Logo */}
      <div className="mb-4">
        {logo ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[var(--background)]">
            <Image
              src={logo}
              alt={`${name} logo`}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white text-2xl font-bold">
            {getInitials(name)}
          </div>
        )}
      </div>

      {/* Product Name */}
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2 line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
        {name}
      </h3>

      {/* Short Description */}
      {shortDescription && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4 line-clamp-2">
          {shortDescription}
        </p>
      )}

      {/* Rating */}
      <div className="mb-4">
        <StarRating rating={averageRating} reviewCount={reviewCount} size="sm" />
      </div>

      {/* Pricing */}
      <div className="mb-4">
        <Badge variant={pricingModel === "Free" ? "accent" : "neutral"}>
          {getPricingDisplay()}
        </Badge>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 3).map((category) => (
            <span
              key={category.slug}
              className="text-xs px-2 py-1 bg-[var(--background)] text-[var(--muted-foreground)] rounded"
            >
              {category.name}
            </span>
          ))}
          {categories.length > 3 && (
            <span className="text-xs px-2 py-1 bg-[var(--background)] text-[var(--muted-foreground)] rounded">
              +{categories.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
