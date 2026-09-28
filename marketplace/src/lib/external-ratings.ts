import type { PrismaClient, RatingSource } from "@prisma/client";
import prisma from "./prisma";

type ExternalRatingsDb = Pick<PrismaClient, "offering" | "externalRating">;

const SOURCES: Array<{ source: RatingSource; label: string; site?: string; autoDiscover: boolean }> = [
  { source: "G2" as RatingSource, label: "G2", site: "g2.com", autoDiscover: true },
  { source: "CAPTERRA" as RatingSource, label: "Capterra", site: "capterra.com", autoDiscover: true },
  { source: "TRUSTPILOT" as RatingSource, label: "Trustpilot", site: "trustpilot.com", autoDiscover: true },
  { source: "GOOGLE" as RatingSource, label: "Google Play", site: "play.google.com", autoDiscover: true },
  { source: "SOFTWARE_ADVICE" as RatingSource, label: "Software Advice", site: "softwareadvice.com", autoDiscover: true },
  { source: "GARTNER" as RatingSource, label: "Gartner", site: "gartner.com", autoDiscover: true },
];

const BLOCKED_HOSTS = [
  "duckduckgo.com",
  "google.com",
  "bing.com",
  "search.yahoo.com",
  "yandex.com",
];

export interface ExternalRatingCandidate {
  source: RatingSource;
  rating: number;
  reviewCount: number;
  url: string;
  confidence: number;
}

export interface ExternalRatingsEnrichmentResult {
  offeringId: string;
  dryRun: boolean;
  candidates: ExternalRatingCandidate[];
  upserted: number;
  errors: Array<{ source: RatingSource; message: string }>;
}

interface OfferingForRatings {
  id: string;
  title: string;
  website?: string | null;
  partner?: { companyName?: string | null } | null;
  categories?: Array<{ name: string; slug: string }>;
}

interface GoogleSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
  pagemap?: {
    aggregaterating?: Array<{
      ratingvalue?: string;
      reviewcount?: string;
      ratingcount?: string;
    }>;
    metatags?: Array<Record<string, string>>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  error?: {
    message?: string;
  };
}

interface SerperSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
  rating?: number;
  ratingCount?: number;
}

interface SerperSearchResponse {
  organic?: SerperSearchItem[];
  places?: SerperSearchItem[];
  knowledgeGraph?: {
    title?: string;
    website?: string;
    rating?: number;
    ratingCount?: number;
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedCandidateUrl(url: string, expectedHost?: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (expectedHost && !hostname.includes(expectedHost)) {
      return false;
    }
    if (!expectedHost && BLOCKED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractJsonLdRatings(html: string) {
  const results: Array<{ rating: number; reviewCount: number }> = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html))) {
    const raw = decodeHtmlEntities(match[1]).trim();
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const aggregateRating =
          node?.aggregateRating ||
          node?.review?.aggregateRating ||
          node?.itemReviewed?.aggregateRating;
        const ratingValue = Number(aggregateRating?.ratingValue);
        const reviewCount = Number(
          aggregateRating?.reviewCount || aggregateRating?.ratingCount || 0
        );

        if (
          Number.isFinite(ratingValue) &&
          ratingValue > 0 &&
          ratingValue <= 5 &&
          Number.isFinite(reviewCount) &&
          reviewCount > 0
        ) {
          results.push({ rating: ratingValue, reviewCount });
        }
      }
    } catch {
      // Some sites include invalid JSON-LD. Fall back to text patterns below.
    }
  }

  return results[0] || null;
}

function extractRatingFromText(html: string) {
  const jsonLdRating = extractJsonLdRatings(html);
  if (jsonLdRating) return jsonLdRating;

  const text = stripHtml(html);
  const ratingPatterns = [
    /(?:rated|rating|score)[^0-9]{0,40}([1-5](?:\.\d)?)[^0-9]{0,16}(?:out of|\/)\s*5/i,
    /([1-5](?:\.\d)?)\s*(?:out of|\/)\s*5[^0-9]{0,60}([\d,]+)\s+reviews?/i,
    /"ratingValue"\s*:\s*"?([1-5](?:\.\d)?)"?/i,
  ];
  const countPatterns = [
    /"reviewCount"\s*:\s*"?([\d,]+)"?/i,
    /([\d,]+)\s+reviews?/i,
    /based on\s+([\d,]+)\s+reviews?/i,
  ];

  const rating = ratingPatterns
    .map((pattern) => text.match(pattern)?.[1])
    .find(Boolean);
  const reviewCount = countPatterns
    .map((pattern) => text.match(pattern)?.[1])
    .find(Boolean);

  if (!rating) return null;

  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) return null;

  return {
    rating: parsedRating,
    reviewCount: reviewCount ? Number(reviewCount.replace(/,/g, "")) || 0 : 0,
  };
}

function extractRatingFromGoogleItem(item: GoogleSearchItem) {
  const aggregateRating = item.pagemap?.aggregaterating?.[0];
  const ratingValue = Number(aggregateRating?.ratingvalue);
  const reviewCount = Number(
    String(aggregateRating?.reviewcount || aggregateRating?.ratingcount || "").replace(/,/g, "")
  );

  if (
    Number.isFinite(ratingValue) &&
    ratingValue > 0 &&
    ratingValue <= 5 &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0
  ) {
    return { rating: ratingValue, reviewCount };
  }

  const text = `${item.title || ""} ${item.snippet || ""}`;
  return extractRatingFromText(text);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; CompassRatingsBot/1.0; +https://example.com)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }

  return response.text();
}

function getGoogleSearchConfig() {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cx) {
    throw new Error(
      "Missing Google Custom Search credentials. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX in .env."
    );
  }

  return { apiKey, cx };
}

function getSerperApiKey() {
  return process.env.SERPER_API_KEY || process.env.SERPER_DEV_API_KEY;
}

async function serperSearch(offering: OfferingForRatings, sourceLabel: string, site?: string) {
  const apiKey = getSerperApiKey();

  if (!apiKey) {
    return null;
  }

  const partner = offering.partner?.companyName || "";
  const category = offering.categories?.[0]?.name || "";
  const siteClause = site ? ` site:${site}` : "";
  const query =
    site === "play.google.com"
      ? `"${offering.title}" site:play.google.com/store/apps/details`
      : `"${offering.title}" ${partner} ${category} ${sourceLabel} rating reviews${siteClause}`.trim();

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 5,
      gl: "in",
      hl: "en",
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await response.json()) as SerperSearchResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || `Serper search failed with ${response.status}`);
  }

  const items = [...(data.organic || []), ...(data.places || [])];
  return items.filter((item) => item.link && isAllowedCandidateUrl(item.link, site));
}

async function googleSearch(offering: OfferingForRatings, sourceLabel: string, site?: string) {
  const { apiKey, cx } = getGoogleSearchConfig();
  const partner = offering.partner?.companyName || "";
  const category = offering.categories?.[0]?.name || "";
  const siteClause = site ? ` site:${site}` : "";
  const query =
    site === "play.google.com"
      ? `"${offering.title}" site:play.google.com/store/apps/details`
      : `"${offering.title}" ${partner} ${category} ${sourceLabel} rating reviews${siteClause}`.trim();
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "5");

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = (await response.json()) as GoogleSearchResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `Google search failed with ${response.status}`);
  }

  return (data.items || []).filter((item) => item.link && isAllowedCandidateUrl(item.link, site));
}

function extractRatingFromSerperItem(item: SerperSearchItem) {
  if (
    typeof item.rating === "number" &&
    item.rating > 0 &&
    item.rating <= 5 &&
    typeof item.ratingCount === "number" &&
    item.ratingCount > 0
  ) {
    return { rating: item.rating, reviewCount: item.ratingCount };
  }

  const text = `${item.title || ""} ${item.snippet || ""}`;
  return extractRatingFromText(text);
}

async function discoverSourceRating(
  offering: OfferingForRatings,
  sourceConfig: (typeof SOURCES)[number]
): Promise<ExternalRatingCandidate | null> {
  const serperResults = await serperSearch(offering, sourceConfig.label, sourceConfig.site);
  const results = serperResults ?? (await googleSearch(offering, sourceConfig.label, sourceConfig.site));

  for (const result of results.slice(0, 5)) {
    const url = result.link;
    if (!url) continue;
    if (!isAllowedCandidateUrl(url, sourceConfig.site)) continue;
    if (
      sourceConfig.site === "play.google.com" &&
      !url.includes("/store/apps/details")
    ) {
      continue;
    }

    const snippetRating =
      "displayLink" in result
        ? extractRatingFromGoogleItem(result)
        : extractRatingFromSerperItem(result);
    if (snippetRating && snippetRating.rating > 0 && snippetRating.reviewCount > 0) {
      return {
        source: sourceConfig.source,
        rating: snippetRating.rating,
        reviewCount: snippetRating.reviewCount,
        url,
        confidence: 0.78,
      };
    }

    try {
      const html = await fetchText(url);
      const extracted = extractRatingFromText(html);

      if (extracted && extracted.rating > 0 && extracted.reviewCount > 0) {
        return {
          source: sourceConfig.source,
          rating: extracted.rating,
          reviewCount: extracted.reviewCount,
          url,
          confidence: sourceConfig.site ? 0.82 : 0.68,
        };
      }
    } catch {
      // Continue trying other candidate URLs.
    }
  }

  return null;
}

export async function extractExternalRatingFromUrl(
  source: RatingSource,
  url: string
): Promise<ExternalRatingCandidate | null> {
  const sourceConfig = SOURCES.find((item) => item.source === source);

  if (!sourceConfig) {
    throw new Error(`Unsupported external rating source: ${source}`);
  }

  if (!isAllowedCandidateUrl(url, sourceConfig.site)) {
    throw new Error(`URL does not match expected source domain for ${source}`);
  }

  const html = await fetchText(url);
  const extracted = extractRatingFromText(html);

  if (!extracted || extracted.rating <= 0 || extracted.reviewCount <= 0) {
    return null;
  }

  return {
    source,
    rating: extracted.rating,
    reviewCount: extracted.reviewCount,
    url,
    confidence: 0.95,
  };
}

export async function upsertOfferingExternalRating(
  offeringId: string,
  candidate: ExternalRatingCandidate,
  db: ExternalRatingsDb = prisma
) {
  return db.externalRating.upsert({
    where: {
      offeringId_source: {
        offeringId,
        source: candidate.source,
      },
    },
    update: {
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      url: candidate.url,
      lastSyncedAt: new Date(),
    },
    create: {
      offeringId,
      source: candidate.source,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      url: candidate.url,
      lastSyncedAt: new Date(),
    },
  });
}

export async function discoverExternalRatingCandidates(offeringId: string) {
  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      title: true,
      website: true,
      partner: { select: { companyName: true } },
      categories: { select: { name: true, slug: true } },
    },
  });

  if (!offering) {
    throw new Error("Offering not found");
  }

  const settled = await Promise.allSettled(
    SOURCES.filter((source) => source.autoDiscover).map((source) =>
      discoverSourceRating(offering, source)
    )
  );

  return settled.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );
}

export async function enrichOfferingExternalRatings(
  offeringId: string,
  options: { dryRun?: boolean; db?: ExternalRatingsDb } = {}
): Promise<ExternalRatingsEnrichmentResult> {
  const db = options.db || prisma;
  const dryRun = options.dryRun ?? false;
  const offering = await db.offering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      status: true,
      title: true,
      website: true,
      partner: { select: { companyName: true } },
      categories: { select: { name: true, slug: true } },
    },
  });

  if (!offering) {
    throw new Error("Offering not found");
  }

  if (offering.status !== "published") {
    return { offeringId, dryRun, candidates: [], upserted: 0, errors: [] };
  }

  const candidates: ExternalRatingCandidate[] = [];
  const errors: Array<{ source: RatingSource; message: string }> = [];

  const discoverableSources = SOURCES.filter((item) => item.autoDiscover);
  const settled = await Promise.allSettled(
    discoverableSources.map((source) => discoverSourceRating(offering, source))
  );

  for (const [index, result] of settled.entries()) {
    const source = discoverableSources[index];
    if (result.status === "fulfilled") {
      if (result.value && result.value.confidence >= 0.65) {
        candidates.push(result.value);
      }
    } else {
      errors.push({
        source: source.source,
        message: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  }

  let upserted = 0;
  if (!dryRun) {
    for (const candidate of candidates) {
      const existing = await db.externalRating.findUnique({
        where: {
          offeringId_source: {
            offeringId,
            source: candidate.source,
          },
        },
      });

      if (existing && existing.rating && candidate.confidence < 0.75) continue;

      await upsertOfferingExternalRating(offeringId, candidate, db);
      upserted++;
    }
  }

  return { offeringId, dryRun, candidates, upserted, errors };
}

export function enrichOfferingExternalRatingsInBackground(offeringId: string) {
  void enrichOfferingExternalRatings(offeringId).catch((error) => {
    console.error("External ratings enrichment failed:", error);
  });
}
