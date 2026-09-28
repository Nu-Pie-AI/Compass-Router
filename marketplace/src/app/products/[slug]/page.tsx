import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { getApiUrl } from "@/lib/api-url";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  const res = await fetch(
    getApiUrl(`api/products/${slug}`),
    { cache: "no-store" }
  );

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch product");
  }

  return res.json();
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  // Redirect to browse page - Products are hidden, use Offerings instead
  redirect('/browse');

  const { slug } = await params;
  const data = await getProduct(slug);

  if (!data) {
    notFound();
  }

  const product = data.data;

  // Format pricing display
  const getPricingDisplay = () => {
    if (product.pricingModel === "Free" || product.startingPrice === 0) {
      return "Free";
    }
    if (product.startingPrice) {
      return `Starting at $${product.startingPrice}/mo`;
    }
    return product.pricingModel || "Contact for pricing";
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Link */}
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </Link>

        {/* Product Header */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Logo */}
            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[var(--background)] flex-shrink-0">
              {product.logo ? (
                <Image
                  src={product.logo}
                  alt={`${product.name} logo`}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white text-3xl font-bold">
                  {product.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-3">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="mb-3">
                <StarRating
                  rating={product.averageRating}
                  reviewCount={product.reviewCount}
                  size="md"
                />
              </div>

              {/* Company */}
              {product.companyName && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  by {product.companyName}
                </p>
              )}

              {/* Categories */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.categories?.map((category: any) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="text-xs px-3 py-1 bg-[var(--background)] text-[var(--muted-foreground)] rounded-full hover:bg-[var(--background)] transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* Pricing Badge */}
              <div className="mb-6">
                <Badge variant={product.pricingModel === "Free" ? "accent" : "neutral"}>
                  {getPricingDisplay()}
                </Badge>
                {product.hasFreeTrial && (
                  <Badge variant="secondary" className="ml-2">
                    Free Trial Available
                  </Badge>
                )}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3">
                {product.websiteUrl && (
                  <a
                    href={product.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
                  >
                    Visit Website
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--border)] hover:bg-[var(--background)] text-[var(--foreground)] font-medium rounded-lg transition-colors">
                  <Mail className="w-4 h-4" />
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video or Screenshot */}
            {product.videoUrl && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
                <div className="aspect-video bg-[var(--background)] rounded-lg overflow-hidden">
                  <iframe
                    src={product.videoUrl.replace("watch?v=", "embed/")}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* About */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
                About {product.name}
              </h2>
              <p className="text-[var(--muted-foreground)] leading-relaxed whitespace-pre-line">
                {product.description}
              </p>

              {/* Key Details */}
              {(product.founded || product.headquarters || product.companySize) && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {product.founded && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                        Founded
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {product.founded}
                      </p>
                    </div>
                  )}
                  {product.headquarters && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                        Headquarters
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {product.headquarters}
                      </p>
                    </div>
                  )}
                  {product.companySize && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                        Company Size
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {product.companySize}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
                <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
                  Key Features
                </h2>
                <div className="space-y-4">
                  {product.features.map((feature: any) => (
                    <div key={feature.id} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-[var(--foreground)]">
                          {feature.name}
                        </h3>
                        {feature.description && (
                          <p className="text-sm text-[var(--muted-foreground)] mt-1">
                            {feature.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Plans */}
            {product.pricingPlans && product.pricingPlans.length > 0 && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
                <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-6">
                  Pricing Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {product.pricingPlans.map((plan: any, index: number) => (
                    <div
                      key={plan.id}
                      className={`border ${
                        index === 1
                          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                          : "border-[var(--border)]"
                      } rounded-lg p-6 relative`}
                    >
                      {index === 1 && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--primary)] text-white text-xs font-medium rounded-full">
                          Popular
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        {plan.name}
                      </h3>
                      <div className="mb-4">
                        {plan.price === 0 ? (
                          <span className="text-3xl font-bold text-[var(--foreground)]">
                            Free
                          </span>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-[var(--foreground)]">
                              ${plan.price}
                            </span>
                            <span className="text-[var(--muted-foreground)]">
                              /{plan.billingCycle}
                            </span>
                          </>
                        )}
                      </div>
                      {plan.features && (
                        <ul className="space-y-2 mb-6">
                          {plan.features.slice(0, 5).map((feature: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-[var(--muted-foreground)] flex items-start gap-2"
                            >
                              <span className="text-[var(--primary)] mt-0.5">✓</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button className="w-full px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors">
                        Get Started
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <ReviewsSection
              productSlug={slug}
              averageRating={product.averageRating}
              reviewCount={product.reviewCount}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 sticky top-20">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Quick Info
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[var(--foreground)] mb-1">
                    Pricing Model
                  </dt>
                  <dd className="text-sm text-[var(--muted-foreground)]">
                    {product.pricingModel || "Contact for pricing"}
                  </dd>
                </div>
                {product.companyName && (
                  <div>
                    <dt className="text-sm font-medium text-[var(--foreground)] mb-1">
                      Company
                    </dt>
                    <dd className="text-sm text-[var(--muted-foreground)]">
                      {product.companyName}
                    </dd>
                  </div>
                )}
                {product.founded && (
                  <div>
                    <dt className="text-sm font-medium text-[var(--foreground)] mb-1">
                      Founded
                    </dt>
                    <dd className="text-sm text-[var(--muted-foreground)]">
                      {product.founded}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-[var(--foreground)] mb-1">
                    Average Rating
                  </dt>
                  <dd className="text-sm text-[var(--muted-foreground)]">
                    {product.averageRating.toFixed(1)} / 5.0
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--foreground)] mb-1">
                    Total Reviews
                  </dt>
                  <dd className="text-sm text-[var(--muted-foreground)]">
                    {product.reviewCount}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
