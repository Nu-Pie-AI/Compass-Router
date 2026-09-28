/**
 * Fallback solution templates by category
 * Used when OpenAI fails or returns brand names
 */

import { AISolution } from './types';

interface FallbackSolutionTemplate {
  category: string;
  getSolution: (
    problem: string,
    answers: Record<string, string>
  ) => AISolution;
}

const fallbackTemplates: Record<string, FallbackSolutionTemplate> = {
  crm: {
    category: 'crm',
    getSolution: (problem, answers) => ({
      summary:
        "Your challenge with managing customer relationships stems from scattered information across multiple tools and manual processes. A structured customer relationship management system will centralize your data, automate routine tasks, and provide visibility into your sales pipeline.",
      actionableSteps: [
        '1. Centralize all customer contact information into a single database with complete interaction history',
        '2. Set up automated lead scoring based on engagement metrics and behavior patterns',
        '3. Create email follow-up sequences for different customer segments and sales stages',
        '4. Implement pipeline tracking with clear stages from lead to closed deal',
        '5. Configure reporting dashboards to monitor key metrics like conversion rates and deal velocity',
        '6. Train your team on data entry best practices and establish consistent workflows',
      ],
      toolTypesNeeded: [
        'Customer relationship management (CRM) platform',
        'Email automation system',
      ],
      estimatedImplementationTime: '2-4 weeks for initial setup, 1-2 months for full adoption',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `Based on your ${answers['q2'] || answers['budget']} budget, focus on solutions with transparent pricing that scales with team size. Many modern CRM platforms offer free tiers for small teams with paid upgrades as you grow.`
        : 'Budget for CRM solutions typically ranges from $20-100 per user per month depending on features needed. Consider free tiers for initial testing.',
    }),
  },

  accounting: {
    category: 'accounting',
    getSolution: (problem, answers) => ({
      summary:
        "Managing finances manually leads to errors, compliance risks, and wasted time. Modern accounting automation will streamline invoicing, expense tracking, and financial reporting while ensuring accuracy and regulatory compliance.",
      actionableSteps: [
        '1. Digitize all invoicing processes with automated payment reminders and online payment options',
        '2. Connect bank accounts for automatic transaction importing and categorization',
        '3. Set up expense tracking with receipt scanning and approval workflows',
        '4. Configure tax calculation and reporting to stay compliant with regulations',
        '5. Create financial dashboards for real-time visibility into cash flow and profitability',
        '6. Establish month-end closing procedures and reconciliation processes',
      ],
      toolTypesNeeded: [
        'Accounting software platform',
        'Payment processing system',
        'Receipt scanning tool',
      ],
      estimatedImplementationTime: '3-6 weeks including data migration and team training',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `With your ${answers['q2'] || answers['budget']} budget, look for accounting platforms that include payment processing, tax calculation, and reporting in the base price. Compare transaction fees carefully.`
        : 'Accounting software typically costs $25-70/month for small businesses, with additional fees for payment processing (2-3% per transaction).',
    }),
  },

  hrtech: {
    category: 'hrtech',
    getSolution: (problem, answers) => ({
      summary:
        "HR inefficiencies stem from manual processes for payroll, time tracking, and employee management. An integrated HR management system will automate administrative tasks, ensure compliance, and improve employee experience.",
      actionableSteps: [
        '1. Implement automated payroll processing with tax calculation and direct deposit',
        '2. Set up time tracking system for accurate attendance and overtime management',
        '3. Digitize employee onboarding with digital forms, e-signatures, and checklists',
        '4. Create self-service portal for employees to access pay stubs and request time off',
        '5. Configure benefits administration and enrollment workflows',
        '6. Establish compliance monitoring for labor laws and reporting requirements',
      ],
      toolTypesNeeded: [
        'Human resources management system (HRMS)',
        'Payroll processing platform',
        'Time and attendance tracking tool',
      ],
      estimatedImplementationTime: '4-8 weeks including payroll migration and compliance setup',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `Based on your ${answers['q2'] || answers['budget']} budget, consider all-in-one HR platforms that include payroll to avoid integration costs. Price per employee typically decreases at scale.`
        : 'HR software costs $5-15 per employee per month, with payroll adding $30-50 base fee plus $4-12 per employee.',
    }),
  },

  marketing: {
    category: 'marketing',
    getSolution: (problem, answers) => ({
      summary:
        "Fragmented marketing efforts across channels result in inconsistent messaging and poor ROI tracking. An integrated marketing platform will unify your campaigns, automate repetitive tasks, and provide clear performance metrics.",
      actionableSteps: [
        '1. Centralize email marketing with segmentation, A/B testing, and automated campaigns',
        '2. Set up social media scheduling and monitoring across all platforms',
        '3. Implement landing page builder with forms and conversion tracking',
        '4. Create automated lead nurturing workflows based on behavior and engagement',
        '5. Configure analytics dashboard to track campaign performance and ROI',
        '6. Develop content calendar for consistent multi-channel execution',
      ],
      toolTypesNeeded: [
        'Marketing automation platform',
        'Email marketing system',
        'Social media management tool',
        'Analytics and reporting software',
      ],
      estimatedImplementationTime: '3-5 weeks for setup, ongoing optimization',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `With your ${answers['q2'] || answers['budget']} budget, prioritize platforms that combine email, social, and automation. Watch for contact-based pricing that scales with your list size.`
        : 'Marketing platforms range from $50-500/month depending on contact volume and features. Start with core email/social capabilities.',
    }),
  },

  'project-management': {
    category: 'project-management',
    getSolution: (problem, answers) => ({
      summary:
        "Project delays and miscommunication occur when work is scattered across emails and spreadsheets. A centralized project management system will provide visibility, streamline collaboration, and keep teams aligned on priorities.",
      actionableSteps: [
        '1. Create standardized project templates with phases, tasks, and milestones',
        '2. Set up task assignment system with clear owners, due dates, and priorities',
        '3. Implement time tracking to monitor project hours and resource allocation',
        '4. Configure automated notifications for deadlines, updates, and blockers',
        '5. Establish file sharing and version control within project context',
        '6. Build reporting dashboards for project status, team capacity, and burndown',
      ],
      toolTypesNeeded: [
        'Project management platform',
        'Team collaboration tool',
        'Time tracking system',
      ],
      estimatedImplementationTime: '2-4 weeks for setup and team adoption',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `Based on your ${answers['q2'] || answers['budget']} budget, look for per-user pricing with unlimited projects. Free tiers often work for teams under 10 people.`
        : 'Project management tools cost $5-25 per user per month. Many offer free plans for small teams with paid upgrades for advanced features.',
    }),
  },

  // Generic fallback for unknown categories
  generic: {
    category: 'generic',
    getSolution: (problem, answers) => ({
      summary:
        "Your business challenge requires a systematic approach combining the right technology tools with clear processes. Success depends on choosing solutions that fit your team's workflow and scale with your growth.",
      actionableSteps: [
        '1. Document current processes and identify specific pain points to address',
        '2. Research solutions that directly solve your core problems without unnecessary complexity',
        '3. Start with a pilot implementation on a small team before full rollout',
        '4. Establish clear metrics to measure improvement and ROI',
        '5. Train your team thoroughly and gather feedback for optimization',
        '6. Review and refine processes quarterly as needs evolve',
      ],
      toolTypesNeeded: ['Business software platform', 'Automation tools'],
      estimatedImplementationTime: '4-6 weeks depending on complexity',
      budgetConsiderations: answers['q2'] || answers['budget']
        ? `With your ${answers['q2'] || answers['budget']} budget, prioritize solutions with transparent pricing and strong customer support. Consider total cost including training time.`
        : 'Software costs vary widely by category. Budget $50-200/month for small team solutions, with costs scaling as you add users and features.',
    }),
  },
};

/**
 * Get fallback solution for a category
 */
export function getFallbackSolution(
  category: string,
  problem: string,
  answers: Record<string, string>
): AISolution {
  const template = fallbackTemplates[category] || fallbackTemplates.generic;
  return template.getSolution(problem, answers);
}

/**
 * List of supported categories with fallback solutions
 */
export const SUPPORTED_CATEGORIES = Object.keys(fallbackTemplates).filter(
  (cat) => cat !== 'generic'
);
