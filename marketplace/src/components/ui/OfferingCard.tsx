import Link from "next/link";
import Image from "next/image";
import { StarRating } from "./StarRating";
import { Badge } from "./Badge";

interface OfferingCardProps {
  slug: string;
  title: string;
  logo?: string;
  shortDescription?: string;
  averageRating: number;
  reviewCount: number;
  pricingModel?: string;
  startingPrice?: number;
  categories?: { slug: string; name: string }[];
  featured?: boolean;
  offeringType?: string;
}

export function OfferingCard({
  slug,
  title,
  logo,
  shortDescription,
  averageRating,
  reviewCount,
  pricingModel,
  startingPrice,
  categories = [],
  featured = false,
  offeringType,
}: OfferingCardProps) {
  // Format pricing display
  const getPricingDisplay = () => {
    if (pricingModel === "Free" || pricingModel === "freemium" || startingPrice === 0) {
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

  // Format offering type badge
  const formatOfferingType = (type?: string) => {
    if (!type) return null;
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Link
      href={`/offerings/${slug}`}
      className="group relative glass-panel rounded-xl p-6 hover:shadow-ambient transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 block"
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
              alt={`${title} logo`}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white text-2xl font-bold">
            {getInitials(title)}
          </div>
        )}
      </div>

      {/* Offering Title */}
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2 line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
        {title}
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

      {/* Pricing and Type */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <Badge variant={pricingModel === "Free" || pricingModel === "freemium" ? "accent" : "neutral"}>
          {getPricingDisplay()}
        </Badge>
        {offeringType && (
          <Badge variant="secondary">
            {formatOfferingType(offeringType)}
          </Badge>
        )}
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
