/**
 * Maps primary function strings to category slugs
 * Used when creating offerings to automatically assign them to the correct categories
 */

export function mapPrimaryFunctionToCategory(primaryFunction: string): string | null {
  if (!primaryFunction) return null;

  const normalized = primaryFunction.toLowerCase().trim();

  // Direct mappings
  const mappings: Record<string, string> = {
    // CRM variations
    'customer relationship management': 'crm',
    'crm': 'crm',
    'sales crm': 'crm',
    'contact management': 'crm',

    // Accounting variations
    'accounting': 'accounting',
    'bookkeeping': 'accounting',
    'financial management': 'accounting',
    'accounting software': 'accounting',

    // HR variations
    'human resources': 'hrtech',
    'hr': 'hrtech',
    'hrtech': 'hrtech',
    'hr management': 'hrtech',
    'payroll': 'hrtech',

    // Marketing variations
    'marketing': 'marketing',
    'email marketing': 'marketing',
    'marketing automation': 'marketing',
    'digital marketing': 'marketing',
    'social media marketing': 'marketing',
    'seo': 'marketing',

    // IT Services
    'it services': 'it-services',
    'it infrastructure': 'it-services',
    'cloud services': 'it-services',
    'managed it': 'it-services',

    // Cybersecurity
    'cybersecurity': 'cybersecurity',
    'security': 'cybersecurity',
    'data protection': 'cybersecurity',
    'information security': 'cybersecurity',

    // ERP
    'erp': 'erp',
    'enterprise resource planning': 'erp',

    // E-commerce (maps to others or marketing depending on context)
    'ecommerce': 'others',
    'ecommerce platform': 'others',
    'e-commerce': 'others',
    'online store': 'others',

    // Inventory
    'inventory': 'inventory',
    'inventory management': 'inventory',
    'warehouse management': 'inventory',

    // Procurement
    'procurement': 'procurement',
    'purchasing': 'procurement',
    'supply chain': 'procurement',

    // Project Management
    'project management': 'project-management',
    'task management': 'project-management',
    'work management': 'project-management',
    'team collaboration': 'project-management',

    // Field Workforce
    'field workforce management': 'field-workforce',
    'field service': 'field-workforce',
    'workforce management': 'field-workforce',

    // Management (general)
    'management': 'management',
    'business management': 'management',

    // Helpdesk
    'helpdesk': 'helpdesk',
    'customer support': 'helpdesk',
    'ticketing': 'helpdesk',
    'service desk': 'helpdesk',

    // Analytics
    'analytics': 'bi-analytics',
    'bi': 'bi-analytics',
    'business intelligence': 'bi-analytics',
    'data analytics': 'bi-analytics',
    'web analytics': 'bi-analytics',
    'reporting': 'bi-analytics',

    // Communication (maps to project-management or others)
    'communication': 'project-management',
    'team communication': 'project-management',
    'collaboration': 'project-management',

    // MDM
    'mdm': 'mdm',
    'master data management': 'mdm',
    'data management': 'mdm',
  };

  // Try direct match first
  if (mappings[normalized]) {
    return mappings[normalized];
  }

  // Try partial matches
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Default to 'others' if no match found
  return 'others';
}

/**
 * Get category ID from slug
 * Returns the category ID if found, null otherwise
 */
export async function getCategoryIdFromSlug(
  prisma: any,
  slug: string
): Promise<string | null> {
  if (!slug) return null;

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  return category?.id || null;
}

/**
 * Assign category to offering based on primaryFunction
 * Returns the category ID if assigned successfully
 */
export async function assignCategoryToOffering(
  prisma: any,
  primaryFunction: string
): Promise<string | null> {
  const categorySlug = mapPrimaryFunctionToCategory(primaryFunction);
  if (!categorySlug) return null;

  return await getCategoryIdFromSlug(prisma, categorySlug);
}
