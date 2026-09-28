// ============================================
// API: Enrich and Create Offerings from Bulk Import
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { openai } from '@/lib/ai/openai';
import {
  BulkImportFileType,
  NormalizedOffering,
} from '@/lib/ai/csv-normalizer';
import { assignCategoryToOffering, getCategoryIdFromSlug } from '@/lib/category-mapper';
import { buildBulkImportPartnerUpdate } from '@/lib/ai-onboarding/bulk-import-partner';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

interface EnrichRequestBody {
  normalizedData: NormalizedOffering[];
  fileType?: BulkImportFileType;
  totalRows?: number;
  warnings?: string[];
}

interface EnrichedOffering extends NormalizedOffering {
  categorySlug: string | null;
  useCases: string[];
  painPointsSolved: string[];
  complianceFlags: string[];
  icpTeamSize: string;
  icpIndustry: string[];
  icpCompanyStage: string;
  icpBudget: string;
  learningCurve: string;
  implementationTime: string;
  confidenceScore: number;
}

const MAX_BULK_ENRICH_ROWS = 50;

function generateBaseSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(
  prismaClient: Prisma.TransactionClient | typeof prisma,
  title: string
): Promise<string> {
  const baseSlug = generateBaseSlug(title);
  let slug = baseSlug || `offering-${Date.now()}`;
  let counter = 1;

  while (await prismaClient.offering.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function enrichOfferingWithAI(
  offering: NormalizedOffering
): Promise<EnrichedOffering> {
  const prompt = `
You are enriching a partner offering for a B2B marketplace.

Offering basics:
- Title: ${offering.title}
- Type: ${offering.type}
- Short description: ${offering.shortDescription || 'Not provided'}
- Full description: ${offering.description || 'Not provided'}
- Website: ${offering.website || 'Not provided'}
- Primary function: ${offering.primaryFunction}
- Integrations: ${offering.integrations.join(', ') || 'Not provided'}
- Regions: ${offering.regions.join(', ')}
- Pricing model: ${offering.pricingModel || 'Not provided'}
- Starting price: ${offering.startingPrice ?? 'Not provided'}
- Free trial: ${String(offering.hasFreeTrial)}
- Partner industry: ${offering.partnerIndustry || 'Not provided'}
- Partner size: ${offering.partnerCompanySize || 'Not provided'}

Return JSON:
{
  "categorySlug": "crm" | "accounting" | "hrtech" | "marketing" | "it-services" | "cybersecurity" | "erp" | "inventory" | "procurement" | "project-management" | "field-workforce" | "management" | "helpdesk" | "bi-analytics" | "mdm" | "others",
  "useCases": ["..."],
  "painPointsSolved": ["..."],
  "complianceFlags": ["..."],
  "idealCustomerProfile": {
    "teamSize": "11-50 people",
    "industry": ["Technology"],
    "companyStage": "Growth",
    "budget": "INR 2,500-INR 7,500/month"
  },
  "learningCurve": "low" | "medium" | "high",
  "implementationTime": "1 day" | "1 week" | "1 month" | "3+ months",
  "confidenceScore": 0-100
}

Rules:
- Keep currency/region context when budget is inferred.
- Prefer concise marketplace-ready strings.
- Use the provided primary function if it already looks valid.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const payload = JSON.parse(response.choices[0].message.content || '{}');

    return {
      ...offering,
      categorySlug: payload.categorySlug || null,
      useCases: ensureStringArray(payload.useCases, [`${offering.title} for SMB teams`]),
      painPointsSolved: ensureStringArray(payload.painPointsSolved, [
        'Manual processes',
        'Lack of automation',
      ]),
      complianceFlags: ensureStringArray(
        payload.complianceFlags,
        offering.partnerComplianceFlags
      ),
      icpTeamSize: stringifyOrFallback(
        payload.idealCustomerProfile?.teamSize,
        '1-50 people'
      ),
      icpIndustry: ensureStringArray(
        payload.idealCustomerProfile?.industry,
        offering.partnerIndustry ? [offering.partnerIndustry] : []
      ),
      icpCompanyStage: stringifyOrFallback(
        payload.idealCustomerProfile?.companyStage,
        'Any stage'
      ),
      icpBudget: stringifyOrFallback(
        payload.idealCustomerProfile?.budget,
        'Varies'
      ),
      learningCurve: normalizeLearningCurve(payload.learningCurve),
      implementationTime: normalizeImplementationTime(payload.implementationTime),
      confidenceScore: normalizeConfidenceScore(payload.confidenceScore),
    };
  } catch (error) {
    console.error('Bulk import AI enrichment error:', error);

    return {
      ...offering,
      categorySlug: null,
      useCases: [`${offering.title} for SMB teams`],
      painPointsSolved: ['Manual processes', 'Operational inefficiencies'],
      complianceFlags: offering.partnerComplianceFlags,
      icpTeamSize: '1-50 people',
      icpIndustry: offering.partnerIndustry ? [offering.partnerIndustry] : [],
      icpCompanyStage: 'Any stage',
      icpBudget: 'Varies',
      learningCurve: 'medium',
      implementationTime: '1 week',
      confidenceScore: 55,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'vendor' && session.user.role !== 'partner') {
      return NextResponse.json(
        { error: 'Forbidden - Only vendors/partners can bulk import' },
        { status: 403 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      );
    }

    if (session.user.role === 'partner' && !isApprovedPartner(partner)) {
      return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
    }

    const body = (await req.json()) as EnrichRequestBody;
    const normalizedData = body.normalizedData || [];
    const fileType = body.fileType || 'csv';
    const totalRows = body.totalRows || normalizedData.length;
    const uploadWarnings = body.warnings || [];

    if (normalizedData.length === 0) {
      return NextResponse.json({ error: 'No data to enrich' }, { status: 400 });
    }

    if (normalizedData.length > MAX_BULK_ENRICH_ROWS) {
      return NextResponse.json(
        { error: `Bulk import is limited to ${MAX_BULK_ENRICH_ROWS} rows per request` },
        { status: 400 }
      );
    }

    const enrichedOfferings: EnrichedOffering[] = [];
    const errors: string[] = [];
    const warnings = [...uploadWarnings];

    for (const offering of normalizedData) {
      try {
        const enriched = await enrichOfferingWithAI(offering);
        warnings.push(...enriched.warnings.map((warning) => `Row ${offering.rowNumber}: ${warning}`));
        enrichedOfferings.push(enriched);
      } catch (error: unknown) {
        errors.push(
          `Row ${offering.rowNumber}: ${
            error instanceof Error ? error.message : 'Failed to enrich offering'
          }`
        );
      }
    }

    if (enrichedOfferings.length === 0) {
      return NextResponse.json(
        {
          error: 'No offerings could be enriched',
          errors,
          warnings,
        },
        { status: 400 }
      );
    }

    const isFirstTimeOnboarding = partner.onboardingStatus !== 'COMPLETED';
    const preparedOfferings = await Promise.all(
      enrichedOfferings.map(async (offering) => {
        const slug = await generateUniqueSlug(prisma, offering.title);
        const categoryId = offering.categorySlug
          ? await getCategoryIdFromSlug(prisma, offering.categorySlug)
          : await assignCategoryToOffering(prisma, offering.primaryFunction);

        return {
          offering,
          slug,
          categoryId,
          status: offering.confidenceScore >= 85 ? 'pending_review' : 'draft',
        };
      })
    );

    const createdOfferings = await prisma.$transaction(async (tx) => {
      const created = [];

      if (isFirstTimeOnboarding) {
        await tx.partner.update({
          where: { id: partner.id },
          data: buildBulkImportPartnerUpdate(partner, enrichedOfferings, {
            fileType,
            totalRows,
            warnings,
            completeOnboarding: true,
          }),
        });
      } else {
        await tx.partner.update({
          where: { id: partner.id },
          data: buildBulkImportPartnerUpdate(partner, enrichedOfferings, {
            fileType,
            totalRows,
            warnings,
            completeOnboarding: false,
          }),
        });
      }

      for (const { offering, slug, categoryId, status } of preparedOfferings) {
        const createdOffering = await tx.offering.create({
          data: {
            partnerId: partner.id,
            slug,
            title: offering.title,
            shortDescription: offering.shortDescription || null,
            description: offering.description || null,
            website: offering.website || null,
            offeringType: offering.type,
            primaryFunction: offering.primaryFunction,
            useCases: offering.useCases,
            painPointsSolved: offering.painPointsSolved,
            integrations: offering.integrations,
            complianceFlags: offering.complianceFlags,
            learningCurve: offering.learningCurve,
            implementationTime: offering.implementationTime,
            icpTeamSize: offering.icpTeamSize,
            icpIndustry: offering.icpIndustry,
            icpCompanyStage: offering.icpCompanyStage,
            icpBudget: offering.icpBudget,
            regions: offering.regions,
            pricingModel: offering.pricingModel || null,
            startingPrice: offering.startingPrice ?? null,
            hasFreeTrial: offering.hasFreeTrial,
            aiGenerated: true,
            humanReviewed: false,
            confidenceScore: offering.confidenceScore,
            fieldConfidence: {
              source: 'partners/bulk-import',
              rowNumber: offering.rowNumber,
              sourceFormat: offering.sourceFormat,
            },
            status,
            ...(categoryId
              ? {
                  categories: {
                    connect: { id: categoryId },
                  },
                }
              : {}),
          },
        });

        await tx.offeringEnrichmentAnswer.createMany({
          data: [
            {
              offeringId: createdOffering.id,
              question: 'Bulk Import Source Data',
              answer: JSON.stringify(
                {
                  rowNumber: offering.rowNumber,
                  sourceFormat: offering.sourceFormat,
                  title: offering.title,
                  partnerCompanyName: offering.partnerCompanyName,
                },
                null,
                2
              ),
              aiGenerated: true,
            },
            {
              offeringId: createdOffering.id,
              question: 'Bulk Import AI Enrichment',
              answer: JSON.stringify(
                {
                  useCases: offering.useCases,
                  painPointsSolved: offering.painPointsSolved,
                  icpTeamSize: offering.icpTeamSize,
                  icpIndustry: offering.icpIndustry,
                  icpCompanyStage: offering.icpCompanyStage,
                  icpBudget: offering.icpBudget,
                  complianceFlags: offering.complianceFlags,
                },
                null,
                2
              ),
              aiGenerated: true,
            },
          ],
        });

        created.push(createdOffering);
      }

      await tx.partner.update({
        where: { id: partner.id },
        data: {
          totalOfferings: { increment: created.length },
        },
      });

      return created;
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    return NextResponse.json({
      success: true,
      offeringsCreated: createdOfferings.length,
      offeringIds: createdOfferings.map((offering) => offering.id),
      onboardingCompleted: isFirstTimeOnboarding && createdOfferings.length > 0,
      errors,
      warnings,
      message: `Successfully created ${createdOfferings.length} offering(s)`,
    });
  } catch (error: unknown) {
    console.error('Bulk import enrichment error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enrich offerings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function ensureStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return fallback;
}

function stringifyOrFallback(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function normalizeLearningCurve(value: unknown): string {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }

  return 'medium';
}

function normalizeImplementationTime(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (['1 day', '1 week', '1 month', '3+ months'].includes(normalized)) {
    return normalized;
  }

  return '1 week';
}

function normalizeConfidenceScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  return 70;
}
