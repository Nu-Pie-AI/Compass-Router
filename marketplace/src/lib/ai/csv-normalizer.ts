// ============================================
// BULK IMPORT NORMALIZER
// Supports CSV and XLSX parsing into a shared row shape
// ============================================

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { OfferingType } from '@prisma/client';

export type BulkImportFileType = 'csv' | 'xlsx';

export interface CSVRow {
  offeringName: string;
  type: string;
  shortDescription?: string;
  fullDescription?: string;
  website?: string;
  category?: string;
  integrations?: string;
  pricingModel?: string;
  startingPrice?: string;
  hasFreeTrial?: string;
  regions?: string;
  companyName: string;
  industry?: string;
  companySize?: string;
  partnerWebsite?: string;
  companyWebsite?: string;
  partnerDescription?: string;
  companyDescription?: string;
  complianceFlags?: string;
  companyComplianceFlags?: string;
}

export interface NormalizedOffering {
  rowNumber: number;
  sourceFormat: BulkImportFileType;
  title: string;
  type: OfferingType;
  shortDescription?: string;
  description?: string;
  website?: string;
  primaryFunction: string;
  integrations: string[];
  pricingModel?: string;
  startingPrice?: number;
  hasFreeTrial: boolean;
  regions: string[];
  useCases?: string[];
  painPointsSolved?: string[];
  complianceFlags?: string[];
  icpTeamSize?: string;
  icpIndustry?: string[];
  icpCompanyStage?: string;
  icpBudget?: string;
  learningCurve?: string;
  implementationTime?: string;
  confidenceScore?: number;
  partnerCompanyName: string;
  partnerIndustry?: string;
  partnerCompanySize?: string;
  partnerWebsite?: string;
  partnerDescription?: string;
  partnerComplianceFlags: string[];
  warnings: string[];
}

export interface BulkImportParseResult {
  fileType: BulkImportFileType;
  totalRows: number;
  validRows: number;
  normalizedData: NormalizedOffering[];
  errors: string[];
  warnings: string[];
}

type RawRecord = Record<string, unknown>;

const HEADER_RULES: Record<string, string[]> = {
  offeringName: [
    'offering name',
    'offeringname',
    'offering',
    'product name',
    'service name',
    'name',
    'title',
  ],
  type: ['type', 'offering type', 'product type', 'service type'],
  companyName: [
    'company name',
    'companyname',
    'company',
    'partner',
    'vendor',
    'organization',
  ],
  shortDescription: [
    'short description',
    'shortdescription',
    'offering summary',
    'offeringsummary',
    'summary',
    'short desc',
    'brief',
  ],
  fullDescription: [
    'full description',
    'fulldescription',
    'offering description',
    'offeringdescription',
    'description',
    'desc',
    'details',
    'long description',
  ],
  website: [
    'website',
    'website url',
    'websiteurl',
    'product website',
    'offering website',
    'product url',
  ],
  partnerWebsite: [
    'partner website',
    'company website',
    'company url',
    'organization website',
  ],
  category: ['category', 'function', 'primary function', 'main category'],
  integrations: ['integrations', 'integration', 'integrates with', 'compatible with'],
  pricingModel: ['pricing model', 'pricingmodel', 'pricing', 'price model', 'payment model'],
  startingPrice: ['starting price', 'startingprice', 'price', 'base price', 'minimum price', 'cost'],
  hasFreeTrial: ['has free trial', 'hasfreetrial', 'free trial', 'trial', 'free tier'],
  regions: ['regions', 'region', 'availability', 'available in', 'locations', 'countries'],
  industry: ['industry', 'sector', 'vertical', 'market'],
  companySize: ['company size', 'companysize', 'size', 'employees', 'team size'],
  partnerDescription: ['partner description', 'company description', 'organization description'],
  complianceFlags: ['compliance flags', 'compliance', 'certifications', 'security certifications'],
};

export function parseImportFile(
  filename: string,
  fileBuffer: Buffer
): BulkImportParseResult {
  const fileType = inferFileType(filename);
  const rawRows = fileType === 'csv' ? parseCSV(fileBuffer.toString('utf-8')) : parseXLSX(fileBuffer);

  return normalizeCSVData(rawRows, fileType);
}

export function parseCSV(csvText: string): CSVRow[] {
  let cleanedText = csvText;

  if (cleanedText.charCodeAt(0) === 0xfeff) {
    cleanedText = cleanedText.slice(1);
  }

  cleanedText = cleanedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const delimiters = [',', ';', '\t', '|'];
  let bestRows: CSVRow[] = [];

  for (const delimiter of delimiters) {
    const parsed = Papa.parse<RawRecord>(cleanedText, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const mappedRows = normalizeParsedRows(parsed.data);
    const validRows = mappedRows.filter(hasRequiredFields);

    if (validRows.length > bestRows.length) {
      bestRows = mappedRows;
    }
  }

  if (bestRows.length === 0) {
    throw new Error(
      'Unable to parse CSV. Required headers: offeringName, type, companyName.'
    );
  }

  return bestRows;
}

function parseXLSX(fileBuffer: Buffer): CSVRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Excel file does not contain any sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRecord>(sheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error('Excel file does not contain any data rows');
  }

  return normalizeParsedRows(rows);
}

function normalizeParsedRows(rows: RawRecord[]): CSVRow[] {
  return rows.map((row) => {
    const normalizedRow: Record<string, string> = {};

    for (const [header, rawValue] of Object.entries(row)) {
      const mappedHeader = mapHeader(header);
      normalizedRow[mappedHeader] = stringifyCell(rawValue);
    }

    return normalizedRow as unknown as CSVRow;
  });
}

function mapHeader(header: string): string {
  const normalized = header.toLowerCase().trim();

  for (const [targetField, variations] of Object.entries(HEADER_RULES)) {
    if (variations.includes(normalized)) {
      return targetField;
    }
  }

  return header.trim();
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function hasRequiredFields(row: CSVRow): boolean {
  return Boolean(row.offeringName && row.type && row.companyName);
}

export function normalizeCSVData(
  rawRows: CSVRow[],
  sourceFormat: BulkImportFileType = 'csv'
): BulkImportParseResult {
  const normalizedData: NormalizedOffering[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (!hasRequiredFields(row)) {
      errors.push(
        `Row ${rowNumber}: missing required fields (offeringName, type, companyName)`
      );
      return;
    }

    const rowWarnings: string[] = [];
    const integrations = parseList(row.integrations);
    const regions = normalizeRegions(parseList(row.regions));
    const partnerComplianceFlags = normalizeComplianceFlags(
      parseList(row.complianceFlags || row.companyComplianceFlags)
    );
    const pricingModel = normalizePricingModel(row.pricingModel);
    const startingPrice = parseStartingPrice(row.startingPrice);

    if (!row.shortDescription && !row.fullDescription) {
      rowWarnings.push('Missing shortDescription/fullDescription; AI will infer more context.');
    }

    if (!row.category) {
      rowWarnings.push('Missing category; primary function will be inferred.');
    }

    if (row.startingPrice && startingPrice === undefined) {
      rowWarnings.push('startingPrice could not be parsed as a number.');
    }

    normalizedData.push({
      rowNumber,
      sourceFormat,
      title: row.offeringName.trim(),
      type: normalizeOfferingType(row.type),
      shortDescription: optionalText(row.shortDescription),
      description: optionalText(row.fullDescription),
      website: optionalText(row.website),
      primaryFunction: normalizeCategory(row.category),
      integrations,
      pricingModel,
      startingPrice,
      hasFreeTrial: normalizeBoolean(row.hasFreeTrial),
      regions,
      partnerCompanyName: row.companyName.trim(),
      partnerIndustry: optionalText(row.industry),
      partnerCompanySize: normalizeCompanySize(row.companySize),
      partnerWebsite: optionalText(row.partnerWebsite || row.companyWebsite),
      partnerDescription: optionalText(
        row.partnerDescription || row.companyDescription
      ),
      partnerComplianceFlags,
      warnings: rowWarnings,
    });

    warnings.push(...rowWarnings.map((warning) => `Row ${rowNumber}: ${warning}`));
  });

  return {
    fileType: sourceFormat,
    totalRows: rawRows.length,
    validRows: normalizedData.length,
    normalizedData,
    errors,
    warnings,
  };
}

export function normalizeOfferingType(type: string): OfferingType {
  const normalized = type.toUpperCase().trim();

  if (
    normalized.includes('PRODUCT') ||
    normalized === 'SAAS' ||
    normalized === 'SOFTWARE'
  ) {
    return 'PRODUCT';
  }
  if (
    normalized.includes('SERVICE') ||
    normalized.includes('CONSULTING') ||
    normalized.includes('ADVISORY')
  ) {
    return 'SERVICE';
  }
  if (normalized.includes('IMPLEMENTATION') || normalized.includes('SETUP')) {
    return 'IMPLEMENTATION';
  }
  if (
    normalized.includes('TRAINING') ||
    normalized.includes('WORKSHOP') ||
    normalized.includes('COURSE')
  ) {
    return 'TRAINING';
  }
  if (normalized.includes('MANAGED')) {
    return 'MANAGED_SERVICE';
  }

  return 'PRODUCT';
}

export function normalizePricingModel(model?: string): string | undefined {
  if (!model) return undefined;

  const normalized = model.toLowerCase().trim();

  if (normalized.includes('free') || normalized === 'freemium') return 'freemium';
  if (normalized.includes('seat') || normalized.includes('user')) return 'per-seat';
  if (normalized.includes('usage') || normalized.includes('transaction')) {
    return 'per-usage';
  }
  if (normalized.includes('custom') || normalized.includes('quote')) return 'custom';
  if (normalized.includes('paid') || normalized.includes('subscription')) return 'paid';

  return 'paid';
}

export function normalizeRegions(regions: string[]): string[] {
  if (regions.length === 0) {
    return ['India'];
  }

  const regionMap: Record<string, string> = {
    us: 'North America',
    usa: 'North America',
    'united states': 'North America',
    canada: 'North America',
    'north america': 'North America',
    eu: 'Europe',
    europe: 'Europe',
    uk: 'Europe',
    'united kingdom': 'Europe',
    india: 'India',
    asia: 'Asia-Pacific',
    apac: 'Asia-Pacific',
    'asia-pacific': 'Asia-Pacific',
    global: 'Global',
    worldwide: 'Global',
  };

  return Array.from(
    new Set(
      regions.map((region) => {
        const key = region.toLowerCase().trim();
        return regionMap[key] || region.trim();
      })
    )
  );
}

export function normalizeCompanySize(size?: string): string | undefined {
  if (!size) return undefined;

  const normalized = size.toLowerCase().trim();

  if (
    normalized.includes('1-10') ||
    normalized.includes('small') ||
    normalized.includes('startup')
  ) {
    return '1-10';
  }
  if (normalized.includes('11-50') || normalized.includes('medium')) {
    return '11-50';
  }
  if (normalized.includes('51-200')) {
    return '51-200';
  }
  if (
    normalized.includes('201-1000') ||
    normalized.includes('201-500') ||
    normalized.includes('large')
  ) {
    return '201-1000';
  }
  if (normalized.includes('1000+') || normalized.includes('enterprise')) {
    return '1000+';
  }

  return size.trim();
}

export function normalizeCategory(category?: string): string {
  if (!category) return 'others';

  const normalized = category.toLowerCase().trim();

  const categoryMap: Record<string, string> = {
    crm: 'crm',
    'customer relationship': 'crm',
    'sales software': 'crm',
    accounting: 'accounting',
    finance: 'accounting',
    bookkeeping: 'accounting',
    marketing: 'marketing',
    'email marketing': 'marketing',
    hrtech: 'hrtech',
    hr: 'hrtech',
    'human resources': 'hrtech',
    'project management': 'project-management',
    'pm tool': 'project-management',
    projects: 'project-management',
    consulting: 'others',
    advisory: 'others',
    'it services': 'it-services',
    cybersecurity: 'cybersecurity',
    security: 'cybersecurity',
    analytics: 'bi-analytics',
    reporting: 'bi-analytics',
    inventory: 'inventory',
    procurement: 'procurement',
    erp: 'erp',
    helpdesk: 'helpdesk',
  };

  return categoryMap[normalized] || 'others';
}

function parseList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/,|;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value?: string): boolean {
  if (!value) {
    return false;
  }

  return ['true', 'yes', 'y', '1'].includes(value.toLowerCase().trim());
}

function parseStartingPrice(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeComplianceFlags(flags: string[]): string[] {
  return Array.from(
    new Set(
      flags.map((flag) => flag.trim()).filter(Boolean)
    )
  );
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function inferFileType(filename: string): BulkImportFileType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';

  throw new Error('Only CSV and XLSX files are supported');
}
