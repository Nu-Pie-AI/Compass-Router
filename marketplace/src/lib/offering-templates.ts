export interface OfferingTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  data: {
    offeringType: 'PRODUCT' | 'SERVICE' | 'IMPLEMENTATION' | 'TRAINING' | 'MANAGED_SERVICE';
    primaryFunction: string;
    pricingModel?: 'freemium' | 'paid' | 'custom' | 'per-seat' | 'per-usage';
    hasFreeTrial?: boolean;
    regions: string[];
    shortDescription?: string;
    description?: string;
  };
}

export const offeringTemplates: OfferingTemplate[] = [
  {
    id: 'crm-saas',
    name: 'CRM Software',
    description: 'Customer relationship management platform',
    icon: '👥',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'crm',
      pricingModel: 'per-seat',
      hasFreeTrial: true,
      regions: ['North America', 'Europe'],
      shortDescription: 'Streamline your sales process with our intuitive CRM platform designed for small and medium businesses.',
      description: 'Our CRM software helps businesses manage customer relationships, track sales pipelines, and automate follow-ups. Features include contact management, deal tracking, email integration, and customizable dashboards. Perfect for sales teams looking to increase productivity and close more deals.',
    },
  },
  {
    id: 'project-management',
    name: 'Project Management Tool',
    description: 'Team collaboration and project tracking',
    icon: '📊',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'project-management',
      pricingModel: 'per-seat',
      hasFreeTrial: true,
      regions: ['Global'],
      shortDescription: 'Powerful project management software to plan, track, and deliver projects on time.',
      description: 'Keep your team aligned with intuitive project planning tools, task management, time tracking, and real-time collaboration features. Built for teams of all sizes with customizable workflows, Gantt charts, and comprehensive reporting.',
    },
  },
  {
    id: 'accounting-software',
    name: 'Accounting Software',
    description: 'Financial management and bookkeeping',
    icon: '💰',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'accounting',
      pricingModel: 'paid',
      hasFreeTrial: true,
      regions: ['North America', 'Europe', 'Asia-Pacific'],
      shortDescription: 'Simple accounting software for small businesses to manage invoices, expenses, and financial reports.',
      description: 'Manage your business finances with ease. Track income and expenses, create professional invoices, generate financial reports, and stay tax-compliant. Includes bank reconciliation, multi-currency support, and integrations with popular payment gateways.',
    },
  },
  {
    id: 'marketing-automation',
    name: 'Marketing Automation',
    description: 'Email campaigns and lead nurturing',
    icon: '📧',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'marketing',
      pricingModel: 'per-usage',
      hasFreeTrial: true,
      regions: ['Global'],
      shortDescription: 'Automate your marketing campaigns with advanced email marketing and lead nurturing tools.',
      description: 'Drive growth with our marketing automation platform. Create personalized email campaigns, segment your audience, track engagement, and nurture leads through automated workflows. Features include A/B testing, landing page builder, and detailed analytics.',
    },
  },
  {
    id: 'consulting-service',
    name: 'Business Consulting',
    description: 'Strategy and advisory services',
    icon: '💼',
    category: 'SERVICE',
    data: {
      offeringType: 'SERVICE',
      primaryFunction: 'consulting',
      pricingModel: 'custom',
      hasFreeTrial: false,
      regions: ['North America', 'Europe'],
      shortDescription: 'Expert business consulting to help you scale, optimize operations, and drive growth.',
      description: 'Our experienced consultants work with SMBs to develop growth strategies, improve operational efficiency, and navigate complex business challenges. Services include strategic planning, process optimization, market analysis, and change management. Typical engagement: 3-6 months.',
    },
  },
  {
    id: 'software-implementation',
    name: 'Software Implementation',
    description: 'System setup and configuration',
    icon: '⚙️',
    category: 'IMPLEMENTATION',
    data: {
      offeringType: 'IMPLEMENTATION',
      primaryFunction: 'implementation',
      pricingModel: 'custom',
      hasFreeTrial: false,
      regions: ['North America', 'Europe'],
      shortDescription: 'Professional software implementation services to ensure smooth deployment and adoption.',
      description: 'We handle the complete implementation of enterprise software solutions. Services include requirements gathering, system configuration, data migration, integration setup, user training, and post-launch support. Ensure your team gets maximum value from day one.',
    },
  },
  {
    id: 'training-program',
    name: 'Training Program',
    description: 'Professional development and certification',
    icon: '🎓',
    category: 'TRAINING',
    data: {
      offeringType: 'TRAINING',
      primaryFunction: 'training',
      pricingModel: 'paid',
      hasFreeTrial: false,
      regions: ['Global'],
      shortDescription: 'Comprehensive training programs to upskill your team and boost productivity.',
      description: 'Expert-led training programs designed for teams. Available as live workshops, self-paced online courses, or customized corporate training. Topics include software tools, digital marketing, project management, and leadership development. Certification available upon completion.',
    },
  },
  {
    id: 'managed-service',
    name: 'Managed IT Services',
    description: 'Ongoing support and maintenance',
    icon: '🛠️',
    category: 'MANAGED_SERVICE',
    data: {
      offeringType: 'MANAGED_SERVICE',
      primaryFunction: 'it-services',
      pricingModel: 'per-seat',
      hasFreeTrial: false,
      regions: ['North America'],
      shortDescription: 'Fully managed IT services to keep your systems running smoothly 24/7.',
      description: 'Focus on your business while we handle your IT infrastructure. Services include 24/7 monitoring, help desk support, security management, backup and disaster recovery, and proactive maintenance. Fixed monthly pricing with no hidden costs.',
    },
  },
  {
    id: 'hr-software',
    name: 'HR Management System',
    description: 'Employee management and payroll',
    icon: '👔',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'hr',
      pricingModel: 'per-seat',
      hasFreeTrial: true,
      regions: ['North America', 'Europe'],
      shortDescription: 'All-in-one HR platform for employee onboarding, time tracking, and payroll management.',
      description: 'Simplify HR operations with our comprehensive HRIS. Manage employee records, automate payroll, track time and attendance, handle benefits administration, and streamline performance reviews. Built for growing businesses with compliance tools and employee self-service portal.',
    },
  },
  {
    id: 'inventory-management',
    name: 'Inventory Management',
    description: 'Stock tracking and order fulfillment',
    icon: '📦',
    category: 'PRODUCT',
    data: {
      offeringType: 'PRODUCT',
      primaryFunction: 'inventory',
      pricingModel: 'paid',
      hasFreeTrial: true,
      regions: ['Global'],
      shortDescription: 'Real-time inventory tracking to optimize stock levels and prevent stockouts.',
      description: 'Manage your inventory across multiple locations with real-time tracking, automated reordering, and barcode scanning. Features include stock alerts, supplier management, order fulfillment tracking, and integration with e-commerce platforms and accounting software.',
    },
  },
];

export function getTemplateById(id: string): OfferingTemplate | undefined {
  return offeringTemplates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): OfferingTemplate[] {
  return offeringTemplates.filter((t) => t.category === category);
}
