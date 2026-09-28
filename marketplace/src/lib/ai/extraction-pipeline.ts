// ============================================
// AI EXTRACTION PIPELINE - GPT-4 STRUCTURED DATA EXTRACTION
// ============================================

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface PartnerProfile {
  companyName: string;
  providerType: 'SOFTWARE_VENDOR' | 'SERVICE_PROVIDER' | 'CONSULTING_FIRM' | 'SYSTEM_INTEGRATOR' | 'HYBRID';
  website: string;
  description: string;
  industry: string;
  companySize: string;
  regions: string[];
  complianceFlags: string[];
  confidenceScore: number;
}

export interface OfferingData {
  type: 'PRODUCT' | 'SERVICE' | 'IMPLEMENTATION' | 'TRAINING' | 'MANAGED_SERVICE';
  title: string;
  shortDescription: string;
  description: string;
  primaryFunction: string;
  categorySlug: string; // AI-assigned category slug
  subCategory: string;
  useCases: string[];
  painPointsSolved: string[];
  integrations: string[];
  idealCustomerProfile: {
    teamSize: string;
    industry: string[];
    companyStage: string;
    budget: string;
  };
  regions: string[];
  pricingModel: string;
  startingPrice: number | null;
  hasFreeTrial: boolean;
  complianceFlags: string[];
  learningCurve: string;
  implementationTime: string;
  confidenceScore: number;
}

export interface ExtractionResult {
  partner: PartnerProfile;
  offerings: OfferingData[];
}

/**
 * Extract structured partner and offering data from website content
 */
export async function extractStructuredData(
  websiteUrl: string,
  homepageContent: string,
  additionalPages?: Array<{ url: string; content: string; type: string }>
): Promise<ExtractionResult> {
  const prompt = `
You are analyzing a company's website to extract structured data for a B2B marketplace.

Website URL: ${websiteUrl}

Homepage Content (first 5000 chars):
${homepageContent.substring(0, 5000)}

${additionalPages && additionalPages.length > 0 ? `
Additional Pages:
${additionalPages.map(p => `- ${p.type}: ${p.content.substring(0, 1000)}`).join('\n')}
` : ''}

Extract and return JSON with:
1. Partner profile (company-level info)
2. All detected offerings (products or services)

Available Categories (choose the best match for categorySlug):
- crm: Customer Relationship Management software
- accounting: Accounting and financial management
- hrtech: Human Resources Technology
- marketing: Marketing automation and tools
- it-services: IT infrastructure and services
- cybersecurity: Security and data protection
- erp: Enterprise Resource Planning
- inventory: Inventory management systems
- procurement: Procurement and purchasing
- project-management: Project and task management tools
- field-workforce: Field operations and workforce management
- management: General management software
- helpdesk: Customer support and ticketing
- bi-analytics: Business intelligence and analytics
- mdm: Master Data Management
- others: Other business software (use if none of the above fit)

Use this exact structure:
{
  "partner": {
    "companyName": "Company Name",
    "providerType": "SOFTWARE_VENDOR" | "SERVICE_PROVIDER" | "CONSULTING_FIRM" | "SYSTEM_INTEGRATOR" | "HYBRID",
    "website": "${websiteUrl}",
    "description": "Brief company description (2-3 sentences)",
    "industry": "SaaS" | "Healthcare" | "Finance" | etc,
    "companySize": "1-10" | "11-50" | "51-200" | "201-1000" | "1000+",
    "regions": ["North America", "Europe", "Asia-Pacific"],
    "complianceFlags": ["SOC2", "GDPR", "HIPAA"],
    "confidenceScore": 85
  },
  "offerings": [
    {
      "type": "PRODUCT" | "SERVICE" | "IMPLEMENTATION" | "TRAINING" | "MANAGED_SERVICE",
      "title": "Product/Service Name",
      "shortDescription": "1-sentence value prop",
      "description": "Full description (2-3 paragraphs)",
      "primaryFunction": "Brief description of main function (e.g., 'Customer Relationship Management', 'Email Marketing', 'Project Management')",
      "categorySlug": "crm" | "accounting" | "hrtech" | "marketing" | "it-services" | "cybersecurity" | "erp" | "inventory" | "procurement" | "project-management" | "field-workforce" | "management" | "helpdesk" | "bi-analytics" | "mdm" | "others",
      "subCategory": "lead-management" | "email-marketing" | etc,
      "useCases": [
        "Lead tracking and follow-up automation",
        "Sales pipeline management",
        "Customer communication history"
      ],
      "painPointsSolved": [
        "Manual lead entry and lost opportunities",
        "Disorganized customer data",
        "Lack of sales visibility"
      ],
      "integrations": ["Salesforce", "Gmail", "Slack", "Zapier"],
      "idealCustomerProfile": {
        "teamSize": "6-20 people" | "1-5 people" | "21-50 people" | "51-200 people" | "200+ people",
        "industry": ["Technology", "SaaS", "Consulting"],
        "companyStage": "Pre-seed/Bootstrapping" | "Seed/Early stage" | "Series A/Growth" | "Established",
        "budget": "$50-200/month" | "Under $50" | "$200-500/month" | "$500+/month"
      },
      "regions": ["North America", "Europe"],
      "pricingModel": "freemium" | "paid" | "custom" | "per-seat",
      "startingPrice": 29,
      "hasFreeTrial": true,
      "complianceFlags": ["GDPR"],
      "learningCurve": "low" | "medium" | "high",
      "implementationTime": "1 day" | "1 week" | "1 month" | "3+ months",
      "confidenceScore": 82
    }
  ]
}

Confidence scoring rules:
- 90-100: Explicit data found on website (pricing table, feature lists, use case examples)
- 70-89: Implicit data inferred from content (general descriptions, no specifics)
- 50-69: Educated guess based on industry norms
- <50: Missing critical info, needs human input

IMPORTANT: Return ONLY valid JSON, no markdown formatting.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a B2B marketplace analyst expert at extracting structured company and product data from websites.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as ExtractionResult;

    // Validate and sanitize
    if (!parsed.partner || !parsed.offerings) {
      throw new Error('Invalid extraction result structure');
    }

    return parsed;
  } catch (error) {
    console.error('AI extraction error:', error);
    throw new Error('Failed to extract structured data from website');
  }
}

/**
 * Calculate field-level confidence scores
 */
export function calculateFieldConfidence(
  field: string,
  value: any,
  source: 'scraped' | 'inferred' | 'default'
): number {
  let confidence = 0;

  if (source === 'scraped') confidence = 90;
  else if (source === 'inferred') confidence = 70;
  else if (source === 'default') confidence = 40;

  // Boost based on field type and value quality
  if (field === 'title' && value && value.length > 5) confidence += 10;
  if (field === 'pricingModel' && ['freemium', 'paid', 'per-seat'].includes(value)) confidence += 10;
  if (field === 'integrations' && Array.isArray(value) && value.length >= 3) confidence += 5;
  if (field === 'useCases' && Array.isArray(value) && value.length >= 3) confidence += 5;

  // Penalize for missing or generic data
  if (!value || (Array.isArray(value) && value.length === 0)) confidence = Math.min(confidence, 40);
  if (value === 'Other' || value === 'Not specified') confidence -= 20;

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Calculate overall confidence for an offering
 */
export function calculateOverallConfidence(fieldConfidences: Record<string, number>): number {
  const weights: Record<string, number> = {
    title: 2,
    shortDescription: 2,
    primaryFunction: 3,
    useCases: 2,
    painPointsSolved: 1.5,
    pricingModel: 1.5,
    icpTeamSize: 1,
    icpBudget: 1,
    integrations: 1,
  };

  let totalWeightedScore = 0;
  let totalWeight = 0;

  Object.entries(fieldConfidences).forEach(([field, confidence]) => {
    const weight = weights[field] || 1;
    totalWeightedScore += confidence * weight;
    totalWeight += weight;
  });

  return Math.round(totalWeightedScore / totalWeight);
}
