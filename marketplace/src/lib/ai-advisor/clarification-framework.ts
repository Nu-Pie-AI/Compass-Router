import { AdvisorKnownFacts, AdvisorQuestion } from './types';
import { CurrencyContext } from './locale';
import { identifyQuestionSlot, shouldAskQuestion } from './facts';

function buildGenericQuestions(
  currencyContext: CurrencyContext
): AdvisorQuestion[] {
  return [
    {
      id: 'team-size',
      text: 'How many team members will actively use this solution?',
      options: [
        '1-5 people',
        '6-20 people',
        '21-50 people',
        '51-100 people',
        '100+ people',
      ],
      allowMultiple: false,
    },
    {
      id: 'budget',
      text: 'What is your monthly budget for this solution?',
      options: currencyContext.monthlyBudgetOptions,
      allowMultiple: false,
    },
    {
      id: 'urgency',
      text: 'How urgently do you need this solution implemented?',
      options: [
        'Immediate (within 1 month)',
        'Soon (1-3 months)',
        'Planning (3-6 months)',
        'Exploring (6+ months)',
      ],
      allowMultiple: false,
    },
    {
      id: 'company-stage',
      text: "What's your company stage right now?",
      options: [
        'Small business',
        'Growing company',
        'Established business',
        'Enterprise',
      ],
      allowMultiple: false,
    },
  ];
}

const categoryQuestionBuilders: Record<
  string,
  (currencyContext: CurrencyContext) => AdvisorQuestion[]
> = {
  accounting: () => [
    {
      id: 'accounting-primary-need',
      text: 'What is your main accounting need right now?',
      options: [
        'Invoicing and billing',
        'Bookkeeping and reconciliation',
        'Payroll and expenses',
        'Tax and compliance reporting',
      ],
      allowMultiple: false,
    },
    {
      id: 'accounting-current-process',
      text: 'How are you handling accounting today?',
      options: [
        'Mostly spreadsheets/manual work',
        'Basic accounting tool but limited automation',
        'Separate tools for payroll, invoicing, and expenses',
        'Outsourced or accountant-led workflow',
      ],
      allowMultiple: false,
    },
    {
      id: 'accounting-integrations',
      text: 'What do you need this accounting system to connect with?',
      options: [
        'Bank feeds and payment gateways',
        'Payroll and HR tools',
        'ERP, inventory, or ecommerce systems',
        'Mostly standalone accounting is fine',
      ],
      allowMultiple: true,
    },
  ],
  crm: () => [
    {
      id: 'crm-primary-need',
      text: 'What is the main CRM outcome you want?',
      options: [
        'Manage leads and pipeline',
        'Track customer relationships and follow-ups',
        'Sales reporting and forecasting',
        'Customer support and account management',
      ],
      allowMultiple: false,
    },
    {
      id: 'crm-current-process',
      text: 'How is your team managing customer data today?',
      options: [
        'Spreadsheets or manual notes',
        'Email and calendar driven workflow',
        'Basic CRM that no longer fits',
        'Different tools across different teams',
      ],
      allowMultiple: false,
    },
    {
      id: 'crm-automation',
      text: 'How important is automation in the CRM?',
      options: [
        'Critical for lead follow-up and reminders',
        'Helpful but not essential',
        'Mostly need visibility and reporting first',
        'Need both automation and reporting',
      ],
      allowMultiple: false,
    },
  ],
  'project-management': () => [
    {
      id: 'pm-primary-need',
      text: 'What kind of work are you managing?',
      options: [
        'Internal team tasks and collaboration',
        'Client projects and delivery timelines',
        'Cross-functional operations and workflows',
        'Product, engineering, or sprint planning',
      ],
      allowMultiple: false,
    },
    {
      id: 'pm-biggest-pain',
      text: 'What is the biggest project-management pain today?',
      options: [
        'Tasks falling through the cracks',
        'Poor visibility into status and ownership',
        'Too much coordination across tools',
        'Reporting and stakeholder updates are hard',
      ],
      allowMultiple: false,
    },
    {
      id: 'pm-collaboration-style',
      text: 'How does your team usually work?',
      options: [
        'Mostly in-office and synchronous',
        'Hybrid or remote collaboration',
        'Client-facing with external stakeholders',
        'Structured sprint or milestone-based planning',
      ],
      allowMultiple: false,
    },
  ],
  marketing: () => [
    {
      id: 'marketing-primary-need',
      text: 'What is your main marketing priority?',
      options: [
        'Email campaigns and automation',
        'Lead generation and conversion',
        'Social media and content planning',
        'Analytics and campaign performance',
      ],
      allowMultiple: false,
    },
    {
      id: 'marketing-channel-focus',
      text: 'Which channels matter most right now?',
      options: [
        'Email and lifecycle campaigns',
        'Paid acquisition and landing pages',
        'Social and content distribution',
        'Multi-channel campaigns',
      ],
      allowMultiple: true,
    },
  ],
  inventory: () => [
    {
      id: 'inventory-primary-need',
      text: 'What inventory challenge are you trying to solve?',
      options: [
        'Stock tracking and reorder control',
        'Warehouse visibility and movement',
        'Order fulfillment and accuracy',
        'Multi-location inventory management',
      ],
      allowMultiple: false,
    },
    {
      id: 'inventory-volume',
      text: 'How complex is your inventory operation?',
      options: [
        'Single location and low SKU count',
        'Growing SKU count or frequent stockouts',
        'Multiple locations or warehouses',
        'Complex fulfillment or supply chain process',
      ],
      allowMultiple: false,
    },
  ],
};

export function getNextFrameworkQuestion(params: {
  category: string;
  knownFacts?: AdvisorKnownFacts;
  answers?: Record<string, string>;
  existingQuestions?: AdvisorQuestion[];
  currencyContext: CurrencyContext;
}): AdvisorQuestion | null {
  const knownFacts = params.knownFacts || {};
  const answers = params.answers || {};
  const existingQuestions = params.existingQuestions || [];
  const askedIds = new Set(existingQuestions.map((question) => question.id));
  const askedSlots = new Set(
    existingQuestions
      .map((question) => identifyQuestionSlot(question))
      .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
  );
  const normalizedCategory = normalizeFrameworkCategory(params.category);

  const categoryQuestions =
    categoryQuestionBuilders[normalizedCategory]?.(params.currencyContext) || [];
  const genericQuestions = buildGenericQuestions(params.currencyContext);
  const orderedQuestions = [...categoryQuestions, ...genericQuestions];

  for (const question of orderedQuestions) {
    if (askedIds.has(question.id)) {
      continue;
    }

    const slot = identifyQuestionSlot(question);
    if (slot && askedSlots.has(slot)) {
      continue;
    }

    if (
      isQuestionAlreadyKnown(question.id, knownFacts, answers) ||
      !shouldAskQuestion(question, knownFacts, answers)
    ) {
      continue;
    }

    return question;
  }

  return null;
}

function normalizeFrameworkCategory(category: string) {
  const normalized = category.toLowerCase().trim();

  if (categoryQuestionBuilders[normalized]) {
    return normalized;
  }

  if (/account|bookkeep|invoice|finance|tax|billing/.test(normalized)) {
    return 'accounting';
  }

  if (/crm|lead|sales|customer-relationship/.test(normalized)) {
    return 'crm';
  }

  if (/project|task|work-management/.test(normalized)) {
    return 'project-management';
  }

  if (/market|campaign|email|social|ads/.test(normalized)) {
    return 'marketing';
  }

  if (/inventory|stock|warehouse|fulfillment/.test(normalized)) {
    return 'inventory';
  }

  return normalized;
}

function isQuestionAlreadyKnown(
  questionId: string,
  knownFacts: AdvisorKnownFacts,
  answers: Record<string, string>
) {
  switch (questionId) {
    case 'team-size':
      return Boolean(knownFacts.teamSize || answers['team-size'] || answers.q1);
    case 'budget':
      return Boolean(knownFacts.budget || answers.budget || answers.q2);
    case 'urgency':
      return Boolean(knownFacts.urgency || answers.urgency || answers.q3);
    case 'company-stage':
      return Boolean(
        knownFacts.companyStage || answers['company-stage'] || answers.q4
      );
    case 'accounting-integrations':
      return Boolean(
        (knownFacts.integrations && knownFacts.integrations.length > 0) ||
          answers.integrations
      );
    case 'accounting-primary-need':
    case 'crm-primary-need':
    case 'crm-automation':
    case 'pm-primary-need':
    case 'pm-biggest-pain':
    case 'marketing-primary-need':
    case 'marketing-channel-focus':
    case 'inventory-primary-need':
      return Boolean(
        (knownFacts.useCases && knownFacts.useCases.length > 0) ||
          answers['use-cases'] ||
          answers[questionId]
      );
    default:
      return Boolean(answers[questionId]);
  }
}
