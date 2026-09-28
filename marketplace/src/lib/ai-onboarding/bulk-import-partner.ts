import { Partner, Prisma, ProviderType } from '@prisma/client';
import { BulkImportFileType, NormalizedOffering } from '@/lib/ai/csv-normalizer';

interface BulkImportPartnerUpdateOptions {
  fileType: BulkImportFileType;
  totalRows: number;
  warnings?: string[];
  completeOnboarding: boolean;
}

export function buildBulkImportPartnerUpdate(
  partner: Partner,
  offerings: NormalizedOffering[],
  options: BulkImportPartnerUpdateOptions
): Prisma.PartnerUpdateInput {
  const mergedRegions = uniqueStrings(
    partner.regions,
    ...offerings.map((offering) => offering.regions)
  );
  const mergedComplianceFlags = uniqueStrings(
    partner.complianceFlags,
    ...offerings.map((offering) => offering.partnerComplianceFlags)
  );

  const companyName = firstNonEmpty(
    partner.companyName,
    ...offerings.map((offering) => offering.partnerCompanyName)
  );
  const website = firstNonEmpty(
    partner.website,
    ...offerings.map((offering) => offering.partnerWebsite || offering.website)
  );
  const description = firstNonEmpty(
    partner.description,
    ...offerings.map(
      (offering) =>
        offering.partnerDescription || offering.description || offering.shortDescription
    )
  );
  const industry = firstNonEmpty(
    partner.industry,
    ...offerings.map((offering) => offering.partnerIndustry)
  );
  const companySize = firstNonEmpty(
    partner.companySize,
    ...offerings.map((offering) => offering.partnerCompanySize)
  );
  const providerType = resolveProviderType(partner.providerType, offerings);
  const overallConfidence = calculatePartnerConfidence(
    companyName,
    description,
    industry,
    companySize,
    mergedRegions,
    mergedComplianceFlags,
    website,
    offerings
  );

  return {
    companyName: companyName ?? null,
    website: website ?? null,
    description: description ?? null,
    providerType,
    industry: industry ?? null,
    companySize: companySize ?? null,
    regions: mergedRegions,
    complianceFlags: mergedComplianceFlags,
    aiExtracted: true,
    overallConfidence,
    scrapedContent: {
      source: 'partners/bulk-import',
      fileType: options.fileType,
      totalRows: options.totalRows,
      importedOfferings: offerings.map((offering) => ({
        rowNumber: offering.rowNumber,
        title: offering.title,
        type: offering.type,
        website: offering.website ?? null,
      })),
      warnings: options.warnings ?? [],
    } satisfies Prisma.InputJsonValue,
    ...(options.completeOnboarding
      ? {
          onboardingStatus: 'COMPLETED' as const,
          onboardingMode: 'SELF_INITIATED' as const,
          onboardedBy: null,
          onboardingStep: 3,
        }
      : {}),
  };
}

function resolveProviderType(
  currentProviderType: ProviderType,
  offerings: NormalizedOffering[]
): ProviderType {
  if (currentProviderType !== 'SOFTWARE_VENDOR') {
    return currentProviderType;
  }

  const hasManagedOrImplementation = offerings.some(
    (offering) =>
      offering.type === 'IMPLEMENTATION' || offering.type === 'MANAGED_SERVICE'
  );
  const hasServicesOnly = offerings.every(
    (offering) => offering.type === 'SERVICE' || offering.type === 'TRAINING'
  );

  if (hasManagedOrImplementation) {
    return 'SYSTEM_INTEGRATOR';
  }

  if (hasServicesOnly) {
    return 'SERVICE_PROVIDER';
  }

  return 'SOFTWARE_VENDOR';
}

function calculatePartnerConfidence(
  companyName: string | null,
  description: string | null,
  industry: string | null,
  companySize: string | null,
  regions: string[],
  complianceFlags: string[],
  website: string | null,
  offerings: NormalizedOffering[]
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
  const averageOfferingConfidence =
    offerings.length > 0
      ? Math.round(
          offerings.reduce(
            (sum, offering) => sum + (offering.confidenceScore ?? 50),
            0
          ) / offerings.length
        )
      : 50;

  return Math.max(
    50,
    Math.min(100, Math.round(coverageScore * 0.7 + averageOfferingConfidence * 0.3))
  );
}

function uniqueStrings(...collections: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(
      collections
        .flatMap((collection) => collection ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}
