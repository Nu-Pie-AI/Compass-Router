import { Partner, Prisma, ProviderType } from '@prisma/client';
import { AIOnboardingContext, ParsedOfferingData } from './types';

export function buildPartnerOnboardingUpdate(
  partner: Partner,
  context: AIOnboardingContext,
  offeringData: ParsedOfferingData
): Prisma.PartnerUpdateInput {
  const mergedRegions = mergeUniqueStrings(
    partner.regions,
    offeringData.regions,
    context.contextSummary?.target_industries ?? []
  );
  const mergedComplianceFlags = mergeUniqueStrings(
    partner.complianceFlags,
    offeringData.complianceFlags,
    context.contextSummary?.security_features ?? []
  );
  const companyDescription = firstNonEmpty(
    safeTrim(partner.description),
    safeTrim(context.contextSummary?.product_description),
    safeTrim(offeringData.shortDescription),
    safeTrim(context.offeringSummary)
  );
  const industry = firstNonEmpty(
    safeTrim(partner.industry),
    offeringData.icpIndustry[0],
    context.contextSummary?.target_industries?.[0]
  );
  const companySize = firstNonEmpty(
    safeTrim(partner.companySize),
    normalizeCompanySize(offeringData.icpTeamSize)
  );
  const website = firstNonEmpty(
    safeTrim(partner.website),
    safeTrim(context.websiteUrl)
  );
  const companyName = firstNonEmpty(
    safeTrim(partner.companyName),
    deriveCompanyNameFromWebsite(website)
  );
  const providerType = resolveProviderType(partner.providerType, offeringData);
  const overallConfidence = calculatePartnerConfidence(
    companyName,
    companyDescription,
    industry,
    companySize,
    mergedRegions,
    mergedComplianceFlags,
    website,
    context,
    offeringData
  );

  return {
    companyName: companyName ?? null,
    website: website ?? null,
    description: companyDescription ?? null,
    providerType,
    industry: industry ?? null,
    companySize: companySize ?? null,
    regions: mergedRegions,
    complianceFlags: mergedComplianceFlags,
    aiExtracted: true,
    scrapedAt: context.websiteScraped ? new Date() : partner.scrapedAt,
    scrapedContent: buildScrapedContent(context, offeringData),
    overallConfidence,
    onboardingStatus: 'COMPLETED',
    onboardingMode: 'SELF_INITIATED',
    onboardedBy: null,
    onboardingStep: 3,
  };
}

function resolveProviderType(
  currentProviderType: ProviderType,
  offeringData: ParsedOfferingData
): ProviderType {
  if (currentProviderType !== 'SOFTWARE_VENDOR') {
    return currentProviderType;
  }

  switch (offeringData.offeringType) {
    case 'PRODUCT':
      return 'SOFTWARE_VENDOR';
    case 'IMPLEMENTATION':
    case 'MANAGED_SERVICE':
      return 'SYSTEM_INTEGRATOR';
    case 'SERVICE':
    case 'TRAINING':
      return 'SERVICE_PROVIDER';
    default:
      return currentProviderType;
  }
}

function normalizeCompanySize(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(/^(\d[\d,]*)\s*-\s*(\d[\d,]*)/);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  const plusMatch = normalized.match(/^(\d[\d,]*)\+/);
  if (plusMatch) {
    return `${plusMatch[1]}+`;
  }

  return normalized.replace(/\s*people$/i, '');
}

function calculatePartnerConfidence(
  companyName: string | null,
  description: string | null,
  industry: string | null,
  companySize: string | null,
  regions: string[],
  complianceFlags: string[],
  website: string | null,
  context: AIOnboardingContext,
  offeringData: ParsedOfferingData
): number {
  const completedFields = [
    companyName,
    description,
    industry,
    companySize,
    website,
    regions.length > 0 ? 'regions' : null,
    complianceFlags.length > 0 ? 'compliance' : null,
  ].filter(Boolean).length;

  const coverageScore = Math.round((completedFields / 7) * 100);
  const signalScore = Math.round(
    ((context.confidenceScore || offeringData.confidenceScore || 0) +
      offeringData.confidenceScore) /
      2
  );

  return Math.max(
    50,
    Math.min(100, Math.round(coverageScore * 0.7 + signalScore * 0.3))
  );
}

function buildScrapedContent(
  context: AIOnboardingContext,
  offeringData: ParsedOfferingData
): Prisma.InputJsonValue {
  const contextSummary = context.contextSummary
    ? ({
        product_description: context.contextSummary.product_description,
        target_industries: context.contextSummary.target_industries,
        use_cases: context.contextSummary.use_cases,
        key_features: context.contextSummary.key_features,
        integrations: context.contextSummary.integrations,
        security_features: context.contextSummary.security_features,
        pricing_signals: context.contextSummary.pricing_signals,
        deployment_models: context.contextSummary.deployment_models,
        implementation_notes: context.contextSummary.implementation_notes,
        tokensUsed: context.contextSummary.tokensUsed,
      } satisfies Prisma.InputJsonObject)
    : null;

  return {
    source: 'partners/offerings/create-ai',
    offeringName: context.offeringName,
    offeringSummary: context.offeringSummary,
    websiteUrl: context.websiteUrl ?? null,
    websiteScraped: context.websiteScraped ?? false,
    estimatedCompleteness: context.estimatedCompleteness ?? null,
    confidenceScore: context.confidenceScore ?? offeringData.confidenceScore,
    contextSummary,
  } satisfies Prisma.InputJsonValue;
}

function mergeUniqueStrings(...collections: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(
      collections
        .flatMap((collection) => collection ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function deriveCompanyNameFromWebsite(website?: string | null): string | null {
  if (!website) {
    return null;
  }

  try {
    const hostname = new URL(
      website.startsWith('http') ? website : `https://${website}`
    ).hostname;
    const candidate = hostname.replace(/^www\./, '').split('.')[0];
    if (!candidate) {
      return null;
    }

    return candidate
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = safeTrim(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function safeTrim(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
