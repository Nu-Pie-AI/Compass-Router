import { OfferingCard } from "@/components/ui/OfferingCard";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { HeroSection } from "@/components/ui/HeroSection";
import { FadeIn } from "@/components/ui/FadeIn";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import prisma from "@/lib/prisma";

// ISR with 1-hour revalidation for better performance
// export const revalidate = 3600; // 1 hour
export const dynamic = 'force-dynamic';

async function getFeaturedOfferings() {
  try {
    const offerings = await prisma.offering.findMany({
      where: { status: "published" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        logo: true,
        averageRating: true,
        reviewCount: true,
        pricingModel: true,
        startingPrice: true,
        hasFreeTrial: true,
        offeringType: true,
        categories: {
          select: { slug: true, name: true },
          take: 2,
        },
      },
      take: 8,
      orderBy: [
        { featured: "desc" },
        { averageRating: "desc" },
      ],
    });
    return offerings;
  } catch (error) {
    console.error("Error fetching featured offerings:", error);
    return [];
  }
}

async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        featured: true,
        _count: {
          select: {
            offerings: {
              where: { status: "published" },
            },
          },
        },
      },
      orderBy: [
        { featured: "desc" },
        { order: "asc" },
        { name: "asc" },
      ],
    });

    return categories
      .map((cat) => ({
        ...cat,
        productCount: cat._count.offerings,
      }))
      .filter((cat) => cat.productCount > 0);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

async function getStats() {
  try {
    const [offeringCount, categoryCount, featureCount] = await Promise.all([
      prisma.offering.count({ where: { status: "published" } }),
      prisma.category.count(),
      prisma.feature.count()
    ]);

    return {
      offerings: offeringCount,
      categories: categoryCount,
      features: featureCount, // Placeholder
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { offerings: 103, categories: 12, features: 100 };
  }
}

export default async function Home() {
  const [featuredOfferings, categories, stats] = await Promise.all([
    getFeaturedOfferings(),
    getCategories(),
    getStats(),
  ]);

  const topCategories = categories
    .sort((a: any, b: any) => b.productCount - a.productCount)
    .slice(0, 8);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
      <HeroSection stats={stats} />

      {/* Featured Offerings Section */}
      {featuredOfferings.length > 0 && (
        <FadeIn delay={0.1}>
          <section className="py-24 border-t border-[var(--border)] relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--border)] to-transparent opacity-10 pointer-events-none" />
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                  Featured Solutions
                </h2>
                <p className="text-[var(--muted-foreground)]">
                  Hand-picked solutions trusted by businesses worldwide
                </p>
              </div>
              <Link
                href="/browse?featured=true"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {featuredOfferings.slice(0, 8).map((offering: any) => (
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
                  categories={offering.categories}
                  featured={offering.featured}
                  offeringType={offering.offeringType}
                />
              ))}
            </div>

            <div className="text-center mt-8 md:hidden relative z-10">
              <Link
                href="/browse?featured=true"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                View all featured solutions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Popular Categories Section */}
      {topCategories.length > 0 && (
        <FadeIn delay={0.15}>
          <section className="py-24 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                  Popular Categories
                </h2>
                <p className="text-[var(--muted-foreground)]">
                  Explore solutions by category
                </p>
              </div>
              <Link
                href="/categories"
                className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {topCategories.map((category: any) => (
                <CategoryCard
                  key={category.id}
                  slug={category.slug}
                  name={category.name}
                  icon={category.icon}
                  productCount={category.productCount}
                  description={category.description}
                />
              ))}
            </div>

            <div className="text-center mt-8 md:hidden">
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
              >
                View all categories
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Features Section */}
      <FadeIn delay={0.2}>
        <section className="py-24 border-t border-[var(--border)]">
          <div className="grid md:grid-cols-3 gap-16 max-w-5xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 border border-[var(--primary)]/30 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-transform duration-300 hover:scale-110">
                <svg
                  className="w-8 h-8 text-[var(--primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">AI-Powered Search</h3>
              <p className="text-[var(--muted-foreground)]">Semantic search that understands intent, not just keywords</p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent-green)]/20 to-[var(--primary)]/20 border border-[var(--accent-green)]/30 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-transform duration-300 hover:scale-110">
                <svg
                  className="w-8 h-8 text-[var(--accent-green)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">Verified Reviews</h3>
              <p className="text-[var(--muted-foreground)]">Real feedback from verified users and industry experts</p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--error)]/20 border border-[var(--accent)]/30 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-transform duration-300 hover:scale-110">
                <svg
                  className="w-8 h-8 text-[var(--accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--foreground)]">Save Time</h3>
              <p className="text-[var(--muted-foreground)]">Compare pricing, features, and reviews in one place</p>
            </div>
          </div>
        </section>
      </FadeIn>
    </div>
  );
}
