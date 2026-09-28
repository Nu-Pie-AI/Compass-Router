import { notFound } from "next/navigation";
import { OfferingCard } from "@/components/ui/OfferingCard";
import { CategorySortDropdown } from "@/components/categories/CategorySortDropdown";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Users,
  FolderKanban,
  Mail,
  BarChart3,
  MessageSquare,
  UserCheck,
  ShoppingCart,
  Shield,
  FileText,
  Zap,
  Settings,
  Globe,
} from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

interface CategoryDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

async function getCategoryOfferings(slug: string, sort: string = "popular") {
  const res = await fetch(
    getApiUrl(`api/categories/${slug}/offerings?sort=${sort}`),
    { cache: "no-store" }
  );

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch category offerings");
  }

  return res.json();
}

// Map category slugs to icons
const getCategoryIcon = (slug: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    crm: <Users className="w-12 h-12" />,
    "project-management": <FolderKanban className="w-12 h-12" />,
    marketing: <Mail className="w-12 h-12" />,
    analytics: <BarChart3 className="w-12 h-12" />,
    communication: <MessageSquare className="w-12 h-12" />,
    "human-resources": <UserCheck className="w-12 h-12" />,
    "e-commerce": <ShoppingCart className="w-12 h-12" />,
    security: <Shield className="w-12 h-12" />,
    documentation: <FileText className="w-12 h-12" />,
    automation: <Zap className="w-12 h-12" />,
    operations: <Settings className="w-12 h-12" />,
    website: <Globe className="w-12 h-12" />,
  };

  return iconMap[slug] || <FolderKanban className="w-12 h-12" />;
};

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  const { sort = "popular" } = await searchParams;

  const data = await getCategoryOfferings(slug, sort);

  if (!data) {
    notFound();
  }

  const category = data.category;
  const offerings = data.data || [];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] mb-6">
          <Link href="/" className="hover:text-[var(--primary)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href="/categories"
            className="hover:text-[var(--primary)] transition-colors"
          >
            Categories
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)] font-medium">{category.name}</span>
        </nav>

        {/* Back Link */}
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
        </Link>

        {/* Category Header */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 mb-8">
          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="text-[var(--primary)]">{getCategoryIcon(slug)}</div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                {category.name}
              </h1>
              {category.description && (
                <p className="text-lg text-[var(--muted-foreground)] mb-4">
                  {category.description}
                </p>
              )}
              <p className="text-sm text-[var(--muted-foreground)]">
                {offerings.length} {offerings.length === 1 ? "solution" : "solutions"} in
                this category
              </p>
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            All Solutions
          </h2>

          {/* Sort Dropdown */}
          <CategorySortDropdown defaultSort={sort} />
        </div>

        {/* Offerings Grid */}
        {offerings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                categories={offering.categories}
                featured={offering.featured}
                offeringType={offering.offeringType}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <p className="text-lg text-[var(--muted-foreground)] mb-4">
              No solutions in this category yet.
            </p>
            <Link
              href="/browse"
              className="text-[var(--primary)] hover:underline"
            >
              Browse all solutions
            </Link>
          </div>
        )}

        {/* Related Categories */}
        {offerings.length > 0 && (
          <div className="mt-16 text-center">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Explore more categories or browse all solutions
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/categories"
                className="text-sm text-[var(--primary)] hover:underline"
              >
                View all categories
              </Link>
              <span className="text-[var(--muted-foreground)]">•</span>
              <Link
                href="/browse"
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Browse all solutions
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
