/**
 * Category Mapping & Keyword Detection
 * Maps AI-detected variations to canonical database category slugs
 */

/**
 * Canonical category aliases - maps common variations to database slugs
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  // CRM variations
  'crm': 'crm',
  'customer-relationship': 'crm',
  'customer-management': 'crm',
  'sales-crm': 'crm',
  'contact-management': 'crm',

  // Accounting variations
  'accounting': 'accounting',
  'bookkeeping': 'accounting',
  'finance': 'accounting',
  'financial-management': 'accounting',
  'invoicing': 'accounting',

  // HRTech variations
  'hrtech': 'hrtech',
  'hr': 'hrtech',
  'human-resources': 'hrtech',
  'hr-management': 'hrtech',
  'payroll': 'hrtech',
  'recruitment': 'hrtech',
  'talent-management': 'hrtech',

  // Marketing variations
  'marketing': 'marketing',
  'marketing-automation': 'marketing',
  'email-marketing': 'marketing',
  'digital-marketing': 'marketing',

  // IT Services variations
  'it-services': 'it-services',
  'it': 'it-services',
  'it-infrastructure': 'it-services',
  'it-management': 'it-services',

  // Cybersecurity variations
  'cybersecurity': 'cybersecurity',
  'security': 'cybersecurity',
  'infosec': 'cybersecurity',
  'data-protection': 'cybersecurity',

  // ERP variations
  'erp': 'erp',
  'enterprise-resource-planning': 'erp',
  'enterprise-software': 'erp',

  // Inventory variations
  'inventory': 'inventory',
  'inventory-management': 'inventory',
  'stock-management': 'inventory',
  'warehouse': 'inventory',

  // Procurement variations
  'procurement': 'procurement',
  'purchasing': 'procurement',
  'sourcing': 'procurement',

  // Project Management variations
  'project-management': 'project-management',
  'projects': 'project-management',
  'project-tracking': 'project-management',
  'task-management': 'project-management',
  'agile': 'project-management',
  'scrum': 'project-management',

  // Field Workforce variations
  'field-workforce': 'field-workforce',
  'field-service': 'field-workforce',
  'workforce-management': 'field-workforce',

  // Management variations
  'management': 'management',
  'business-management': 'management',

  // Helpdesk variations
  'helpdesk': 'helpdesk',
  'help-desk': 'helpdesk',
  'customer-support': 'helpdesk',
  'ticketing': 'helpdesk',
  'service-desk': 'helpdesk',

  // BI & Analytics variations
  'bi-analytics': 'bi-analytics',
  'analytics': 'bi-analytics',
  'business-intelligence': 'bi-analytics',
  'bi': 'bi-analytics',
  'data-analytics': 'bi-analytics',
  'reporting': 'bi-analytics',
  'dashboard': 'bi-analytics',

  // MDM variations
  'mdm': 'mdm',
  'master-data-management': 'mdm',
  'data-management': 'mdm',

  // Others
  'others': 'others',
  'general': 'others',
  'miscellaneous': 'others',
};

/**
 * Keyword-based detection - maps keywords in queries to categories
 * Used as fallback when alias mapping fails
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'crm': [
    'customer', 'sales', 'pipeline', 'lead', 'contact', 'deal',
    'opportunity', 'prospect', 'client relationship',
  ],
  'accounting': [
    'accounting', 'invoice', 'expense', 'bookkeeping', 'tax',
    'ledger', 'financial', 'billing', 'payment',
  ],
  'hrtech': [
    'hr', 'payroll', 'employee', 'recruitment', 'hiring', 'talent',
    'onboarding', 'benefits', 'time tracking', 'leave management',
  ],
  'marketing': [
    'marketing', 'campaign', 'email marketing', 'social media',
    'seo', 'content', 'advertising', 'brand',
  ],
  'it-services': [
    'it infrastructure', 'server', 'network', 'cloud', 'hosting',
    'infrastructure', 'devops',
  ],
  'cybersecurity': [
    'security', 'firewall', 'antivirus', 'encryption', 'vulnerability',
    'penetration', 'compliance', 'gdpr',
  ],
  'erp': [
    'erp', 'enterprise', 'resource planning', 'integrated system',
  ],
  'inventory': [
    'inventory', 'stock', 'warehouse', 'fulfillment', 'logistics',
  ],
  'procurement': [
    'procurement', 'purchasing', 'sourcing', 'vendor management',
    'supplier', 'purchase order',
  ],
  'project-management': [
    'project', 'task', 'agile', 'scrum', 'kanban', 'sprint',
    'milestone', 'gantt', 'workflow',
  ],
  'field-workforce': [
    'field service', 'dispatch', 'technician', 'mobile workforce',
    'on-site', 'field operations',
  ],
  'management': [
    'business management', 'operations', 'process management',
  ],
  'helpdesk': [
    'helpdesk', 'support', 'ticket', 'service desk', 'customer service',
    'incident', 'issue tracking',
  ],
  'bi-analytics': [
    'analytics', 'business intelligence', 'reporting', 'dashboard',
    'data visualization', 'metrics', 'kpi', 'insights', 'data analysis',
    'blockchain analytics', 'blockchain data', 'blockchain tracking',
  ],
  'mdm': [
    'master data', 'data governance', 'data quality',
  ],
};

/**
 * Map AI-detected category to canonical database slug
 * @param detectedCategory - Category string from AI
 * @returns Canonical slug or null if no mapping found
 */
export function mapCategoryToSlug(detectedCategory: string): string | null {
  if (!detectedCategory) return null;

  // Normalize input
  const normalized = detectedCategory
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

  // Try direct alias lookup
  if (CATEGORY_ALIASES[normalized]) {
    return CATEGORY_ALIASES[normalized];
  }

  // Try without hyphens
  const noHyphens = normalized.replace(/-/g, '');
  for (const [alias, slug] of Object.entries(CATEGORY_ALIASES)) {
    if (alias.replace(/-/g, '') === noHyphens) {
      return slug;
    }
  }

  return null;
}

/**
 * Detect category from problem description using keyword matching
 * @param problemDescription - User's problem description
 * @returns Best matching category slug or null
 */
export function detectCategoryFromKeywords(
  problemDescription: string
): string | null {
  if (!problemDescription) return null;

  const lowerProblem = problemDescription.toLowerCase();
  const categoryScores: Record<string, number> = {};

  // Score each category based on keyword matches
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerProblem.includes(keyword.toLowerCase())) {
        // Longer keywords get higher scores (more specific)
        score += keyword.split(' ').length;
      }
    }
    if (score > 0) {
      categoryScores[category] = score;
    }
  }

  // Return category with highest score
  if (Object.keys(categoryScores).length === 0) {
    return null;
  }

  const bestCategory = Object.entries(categoryScores).sort(
    ([, a], [, b]) => b - a
  )[0];

  return bestCategory[0];
}

/**
 * Get user-friendly suggestions for invalid category
 * @param detectedCategory - Invalid category detected
 * @returns Array of suggested category slugs
 */
export function getCategorySuggestions(detectedCategory: string): string[] {
  const normalized = detectedCategory.toLowerCase();
  const suggestions: string[] = [];

  // Find similar aliases
  for (const [alias, slug] of Object.entries(CATEGORY_ALIASES)) {
    if (
      alias.includes(normalized) ||
      normalized.includes(alias) ||
      levenshteinDistance(alias, normalized) <= 2
    ) {
      if (!suggestions.includes(slug)) {
        suggestions.push(slug);
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
