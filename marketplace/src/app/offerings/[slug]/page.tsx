import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  Linkedin,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { OfferingActions } from "@/components/offering/OfferingActions";
import { OfferingReviewsSection } from "@/components/offering/OfferingReviewsSection";
import { OfferingTracking } from "@/components/offering/OfferingTracking";
import { OfferingTrackedLink } from "@/components/offering/OfferingTrackedLink";

interface OfferingDetailPageProps {
  params: Promise<{ slug: string }>;
}

interface OfferingCategory {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
}

interface OfferingFeature {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  order: number;
}

interface OfferingPricingPlan {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  billingCycle?: string | null;
  currency: string;
  features: string[];
  popular: boolean;
  order: number;
}

interface OfferingScreenshot {
  id: string;
  url: string;
  title?: string | null;
  order: number;
}

interface OfferingExternalRating {
  id: string;
  source: string;
  rating: number;
  reviewCount: number;
  url?: string | null;
  lastSyncedAt?: Date | string | null;
}

interface OfferingPartner {
  id: string;
  companyName?: string | null;
  providerType: string;
  website?: string | null;
  linkedInUrl?: string | null;
  description?: string | null;
  logo?: string | null;
  industry?: string | null;
  companySize?: string | null;
  regions: string[];
  complianceFlags: string[];
  verifiedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  publishedOfferings: number;
  totalViews: number;
  totalLeads: number;
}

interface OfferingDetail {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  logo?: string | null;
  videoUrl?: string | null;
  website?: string | null;
  offeringType: string;
  primaryFunction: string;
  subCategory?: string | null;
  useCases: string[];
  painPointsSolved: string[];
  integrations: string[];
  complianceFlags: string[];
  learningCurve?: string | null;
  implementationTime?: string | null;
  icpTeamSize?: string | null;
  icpIndustry: string[];
  icpCompanyStage?: string | null;
  icpBudget?: string | null;
  pricingModel?: string | null;
  startingPrice?: number | null;
  hasFreeTrial: boolean;
  freeTrialDays?: number | null;
  regions: string[];
  averageRating: number;
  reviewCount: number;
  viewCount: number;
  status: string;
  featured: boolean;
  publishedAt?: Date | string | null;
  categories: OfferingCategory[];
  features: OfferingFeature[];
  pricingPlans: OfferingPricingPlan[];
  screenshots: OfferingScreenshot[];
  partner: OfferingPartner;
}

type OfferingDetailQueryResult = Omit<OfferingDetail, "externalRatings">;

export const revalidate = 120;

async function getOffering(slug: string) {
  const findOffering = prisma.offering.findUnique as unknown as (
    args: unknown
  ) => Promise<OfferingDetailQueryResult | null>;

  const offering = await findOffering({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      shortDescription: true,
      description: true,
      logo: true,
      videoUrl: true,
      website: true,
      offeringType: true,
      primaryFunction: true,
      subCategory: true,
      useCases: true,
      painPointsSolved: true,
      integrations: true,
      complianceFlags: true,
      learningCurve: true,
      implementationTime: true,
      icpTeamSize: true,
      icpIndustry: true,
      icpCompanyStage: true,
      icpBudget: true,
      pricingModel: true,
      startingPrice: true,
      hasFreeTrial: true,
      freeTrialDays: true,
      regions: true,
      averageRating: true,
      reviewCount: true,
      viewCount: true,
      status: true,
      featured: true,
      publishedAt: true,
      categories: {
        select: {
          id: true,
          slug: true,
          name: true,
          icon: true,
        },
      },
      features: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          order: true,
        },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
      pricingPlans: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          billingCycle: true,
          currency: true,
          features: true,
          popular: true,
          order: true,
        },
        orderBy: [{ order: "asc" }, { price: "asc" }],
      },
      screenshots: {
        select: {
          id: true,
          url: true,
          title: true,
          order: true,
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      partner: {
        select: {
          id: true,
          companyName: true,
          providerType: true,
          website: true,
          linkedInUrl: true,
          description: true,
          logo: true,
          industry: true,
          companySize: true,
          regions: true,
          complianceFlags: true,
          verifiedAt: true,
          approvedAt: true,
          publishedOfferings: true,
          totalViews: true,
          totalLeads: true,
        },
      },
    },
  });

  if (!offering) return null;

  return {
    ...offering,
    externalRatings: await getExternalRatings(offering.id),
  };
}

async function getExternalRatings(offeringId: string): Promise<OfferingExternalRating[]> {
  try {
    return await prisma.$queryRaw<OfferingExternalRating[]>`
      SELECT
        "id",
        "source"::text AS "source",
        "rating",
        "reviewCount",
        "url",
        "lastSyncedAt"
      FROM "external_ratings"
      WHERE "offeringId" = ${offeringId}
      ORDER BY "source" ASC
    `;
  } catch {
    return [];
  }
}

function formatLabel(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPricing(offering: OfferingDetail) {
  const model = offering.pricingModel?.toLowerCase();

  if (model === "free" || offering.startingPrice === 0) return "Free";
  if (typeof offering.startingPrice === "number") {
    return `From ${formatCurrency(offering.startingPrice)}`;
  }
  return offering.pricingModel ? formatLabel(offering.pricingModel) : "Contact for pricing";
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function getVideoEmbedUrl(videoUrl?: string | null) {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : videoUrl;
    }
    if (url.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${url.pathname.replace("/", "")}`;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : videoUrl;
    }
  } catch {
    return videoUrl;
  }

  return videoUrl;
}

function groupFeatures(features: OfferingFeature[]) {
  return features.reduce<Record<string, OfferingFeature[]>>((groups, feature) => {
    const key = feature.category || "Core Features";
    groups[key] = groups[key] || [];
    groups[key].push(feature);
    return groups;
  }, {});
}

function ratingSourceLabel(source: string) {
  return source
    .replace("SOFTWARE_ADVICE", "Software Advice")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function OfferingDetailPage({ params }: OfferingDetailPageProps) {
  const { slug } = await params;
  const offering = await getOffering(slug);

  if (!offering || offering.status !== "published") {
    notFound();
  }

  const featureGroups = groupFeatures(offering.features || []);
  const videoEmbedUrl = getVideoEmbedUrl(offering.videoUrl);
  const primaryCategory = offering.categories?.[0];
  const partner = offering.partner;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <OfferingTracking slug={offering.slug} />

      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </Link>
        </div>
      </div>

      <section className="bg-[var(--surface)]">
        <div className="container mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_360px] lg:py-12">
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              {offering.featured && <Badge variant="primary">Featured</Badge>}
              <Badge variant="secondary">{formatLabel(offering.offeringType)}</Badge>
              {primaryCategory && (
                <Link href={`/categories/${primaryCategory.slug}`}>
                  <Badge variant="outline" className="transition hover:border-[var(--primary)] hover:text-[var(--primary)]">
                    {primaryCategory.name}
                  </Badge>
                </Link>
              )}
              {offering.subCategory && <Badge variant="outline">{formatLabel(offering.subCategory)}</Badge>}
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--background)]">
                {offering.logo ? (
                  <Image
                    src={offering.logo}
                    alt={`${offering.title} logo`}
                    fill
                    priority
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--primary)] text-4xl font-bold text-white">
                    {offering.title.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)] md:text-5xl">
                  {offering.title}
                </h1>

                {partner && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <Building2 className="h-4 w-4" />
                    <span>
                      by <span className="font-semibold text-[var(--foreground)]">{partner.companyName || "Partner"}</span>
                    </span>
                    {(partner.verifiedAt || partner.approvedAt) && (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <BadgeCheck className="h-4 w-4" />
                        Verified partner
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <StarRating
                    rating={offering.averageRating || 0}
                    reviewCount={offering.reviewCount || 0}
                    size="md"
                  />
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {offering.viewCount?.toLocaleString?.() || 0} views
                  </span>
                </div>

                {offering.shortDescription && (
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted-foreground)]">
                    {offering.shortDescription}
                  </p>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 lg:sticky lg:top-24 lg:self-start">
            <div className="mb-5">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Pricing</p>
              <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{formatPricing(offering)}</p>
              {offering.hasFreeTrial && (
                <p className="mt-2 text-sm font-medium text-green-700">
                  Free trial available{offering.freeTrialDays ? ` for ${offering.freeTrialDays} days` : ""}
                </p>
              )}
            </div>

            <OfferingActions
              slug={offering.slug}
              website={offering.website}
              offeringTitle={offering.title}
              partnerName={partner?.companyName}
            />

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-5 text-sm">
              <InfoStat label="Type" value={formatLabel(offering.offeringType)} />
              <InfoStat label="Function" value={formatLabel(offering.primaryFunction)} />
              {offering.implementationTime && <InfoStat label="Setup" value={offering.implementationTime} />}
              {offering.learningCurve && <InfoStat label="Learning" value={formatLabel(offering.learningCurve)} />}
            </div>
          </aside>
        </div>
      </section>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            {(videoEmbedUrl || offering.screenshots?.length > 0) && (
              <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                {videoEmbedUrl ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      src={videoEmbedUrl}
                      title={`${offering.title} video`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    {offering.screenshots.map((screenshot: OfferingScreenshot) => (
                      <figure key={screenshot.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                        <div className="relative aspect-video">
                          <Image
                            src={screenshot.url}
                            alt={screenshot.title || `${offering.title} screenshot`}
                            fill
                            sizes="(min-width: 1024px) 420px, 100vw"
                            className="object-cover"
                          />
                        </div>
                        {screenshot.title && (
                          <figcaption className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
                            {screenshot.title}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </section>
            )}

            <Section title="Overview" icon={<Sparkles className="h-5 w-5" />}>
              {offering.description && (
                <p className="whitespace-pre-line leading-8 text-[var(--muted-foreground)]">
                  {offering.description}
                </p>
              )}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <ListBlock title="Use Cases" items={offering.useCases} icon={<Target className="h-4 w-4" />} />
                <ListBlock title="Problems Solved" items={offering.painPointsSolved} icon={<CheckCircle2 className="h-4 w-4" />} />
              </div>
            </Section>

            {Object.keys(featureGroups).length > 0 && (
              <Section title="Features" icon={<Wrench className="h-5 w-5" />}>
                <div className="grid gap-5">
                  {Object.entries(featureGroups).map(([category, features]) => (
                    <div key={category}>
                      <h3 className="mb-3 font-semibold text-[var(--foreground)]">{category}</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {features.map((feature) => (
                          <div key={feature.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                            <p className="font-medium text-[var(--foreground)]">{feature.name}</p>
                            {feature.description && (
                              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                                {feature.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {(offering.pricingPlans?.length > 0 || offering.pricingModel || offering.startingPrice !== null) && (
              <Section title="Pricing" icon={<Award className="h-5 w-5" />}>
                {offering.pricingPlans?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {offering.pricingPlans.map((plan: OfferingPricingPlan) => (
                      <div
                        key={plan.id}
                        className={`rounded-lg border p-5 ${
                          plan.popular
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-[var(--border)] bg-[var(--background)]"
                        }`}
                      >
                        {plan.popular && <Badge variant="primary">Popular</Badge>}
                        <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{plan.name}</h3>
                        {plan.description && (
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{plan.description}</p>
                        )}
                        <p className="mt-4 text-2xl font-bold text-[var(--foreground)]">
                          {typeof plan.price === "number"
                            ? plan.price === 0
                              ? "Free"
                              : formatCurrency(plan.price, plan.currency || "USD")
                            : "Custom"}
                          {plan.billingCycle && plan.price !== null && plan.price !== 0 && (
                            <span className="text-sm font-normal text-[var(--muted-foreground)]"> / {plan.billingCycle}</span>
                          )}
                        </p>
                        {plan.features?.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {plan.features.map((item: string) => (
                              <li key={item} className="flex gap-2 text-sm text-[var(--muted-foreground)]">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-[var(--background)] p-5">
                    <p className="text-2xl font-bold text-[var(--foreground)]">{formatPricing(offering)}</p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Contact the partner for detailed pricing, packaging, and implementation terms.
                    </p>
                  </div>
                )}
              </Section>
            )}

            <OfferingReviewsSection
              slug={offering.slug}
              initialAverageRating={offering.averageRating || 0}
              initialReviewCount={offering.reviewCount || 0}
            />
          </div>

          <aside className="space-y-6">
            <SideSection title="Best Fit" icon={<Users className="h-5 w-5" />}>
              <InfoRows
                rows={[
                  ["Team size", offering.icpTeamSize],
                  ["Industries", offering.icpIndustry?.join(", ")],
                  ["Company stage", offering.icpCompanyStage],
                  ["Typical budget", offering.icpBudget],
                  ["Regions", offering.regions?.join(", ")],
                ]}
              />
            </SideSection>

            <SideSection title="Implementation" icon={<Clock className="h-5 w-5" />}>
              <InfoRows
                rows={[
                  ["Setup time", offering.implementationTime],
                  ["Learning curve", formatLabel(offering.learningCurve)],
                  ["Integrations", offering.integrations?.join(", ")],
                ]}
              />
            </SideSection>

            {offering.complianceFlags?.length > 0 && (
              <SideSection title="Compliance" icon={<ShieldCheck className="h-5 w-5" />}>
                <div className="flex flex-wrap gap-2">
                  {offering.complianceFlags.map((flag: string) => (
                    <Badge key={flag} variant="success">{flag}</Badge>
                  ))}
                </div>
              </SideSection>
            )}

            {offering.externalRatings?.length > 0 && (
              <SideSection title="External Ratings" icon={<Star className="h-5 w-5" />}>
                <div className="space-y-3">
                  {offering.externalRatings.map((rating: OfferingExternalRating) => (
                    <a
                      key={rating.id}
                      href={rating.url || "#"}
                      target={rating.url ? "_blank" : undefined}
                      rel={rating.url ? "noopener noreferrer" : undefined}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 transition hover:border-[var(--primary)]"
                    >
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{ratingSourceLabel(rating.source)}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {rating.reviewCount.toLocaleString()} reviews
                        </p>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-[var(--foreground)]">
                        <Star className="h-4 w-4 fill-[var(--secondary)] text-[var(--secondary)]" />
                        {rating.rating.toFixed(1)}
                      </div>
                    </a>
                  ))}
                </div>
              </SideSection>
            )}

            {partner && (
              <SideSection title="Partner" icon={<Building2 className="h-5 w-5" />}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[var(--background)]">
                    {partner.logo ? (
                      <Image
                        src={partner.logo}
                        alt={`${partner.companyName || "Partner"} logo`}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--primary)] font-bold text-white">
                        {(partner.companyName || "P").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{partner.companyName || "Partner"}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">{formatLabel(partner.providerType)}</p>
                  </div>
                </div>

                {partner.description && (
                  <p className="mb-4 text-sm leading-6 text-[var(--muted-foreground)]">{partner.description}</p>
                )}

                <InfoRows
                  rows={[
                    ["Industry", partner.industry],
                    ["Company size", partner.companySize],
                    ["Regions", partner.regions?.join(", ")],
                    ["Published offerings", partner.publishedOfferings?.toString()],
                  ]}
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {partner.website && (
                    <OfferingTrackedLink slug={offering.slug} href={partner.website} clickType="partner_website">
                      <Globe2 className="h-4 w-4" />
                      Website
                    </OfferingTrackedLink>
                  )}
                  {partner.linkedInUrl && (
                    <OfferingTrackedLink slug={offering.slug} href={partner.linkedInUrl} clickType="partner_linkedin">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </OfferingTrackedLink>
                  )}
                </div>
              </SideSection>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="text-[var(--primary)]">{icon}</span>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SideSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[var(--primary)]">{icon}</span>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ListBlock({
  title,
  items,
  icon,
}: {
  title: string;
  items?: string[];
  icon: ReactNode;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-[var(--foreground)]">
          {icon}
          {title}
        </h3>
        <p className="text-sm text-[var(--muted-foreground)]">No details added yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--foreground)]">
        {icon}
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--muted-foreground)]">
            <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function InfoRows({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const visibleRows = rows.filter(([, value]) => Boolean(value));

  if (visibleRows.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No details added yet.</p>;
  }

  return (
    <dl className="space-y-3">
      {visibleRows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-[var(--muted-foreground)]">{label}</dt>
          <dd className="mt-1 text-sm text-[var(--foreground)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
