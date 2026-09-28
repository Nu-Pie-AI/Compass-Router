import { AdvisorKnownFacts, AdvisorQuestion } from './types';

const COMMON_INTEGRATIONS = [
  'gmail',
  'google workspace',
  'outlook',
  'microsoft 365',
  'slack',
  'zapier',
  'shopify',
  'woocommerce',
  'quickbooks',
  'xero',
  'paypal',
  'stripe',
  'whatsapp',
  'hubspot',
  'salesforce',
];

export function extractKnownFacts(
  problem: string,
  detectedCategory?: string | null
): AdvisorKnownFacts {
  return {
    category: detectedCategory || extractCategory(problem),
    teamSize: extractTeamSize(problem),
    budget: extractBudget(problem),
    urgency: extractUrgency(problem),
    companyStage: extractCompanyStage(problem),
    useCases: extractUseCases(problem),
    integrations: extractIntegrations(problem),
  };
}

export function mergeKnownFacts(
  existing: AdvisorKnownFacts = {},
  incoming: AdvisorKnownFacts = {}
): AdvisorKnownFacts {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming).filter(
        ([key, value]) =>
          key !== 'useCases' &&
          key !== 'integrations' &&
          key !== 'rejectedProducts' &&
          key !== 'constraints' &&
          value !== undefined &&
          value !== null &&
          value !== ''
      )
    ),
    useCases: mergeArray(existing.useCases, incoming.useCases),
    integrations: mergeArray(existing.integrations, incoming.integrations),
    rejectedProducts: mergeArray(
      existing.rejectedProducts,
      incoming.rejectedProducts
    ),
    constraints: mergeArray(existing.constraints, incoming.constraints),
  };
}

export function mergeArray(existing: string[] = [], incoming: string[] = []) {
  return Array.from(
    new Set(
      [...existing, ...incoming]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function shouldAskQuestion(
  question: Pick<AdvisorQuestion, 'id' | 'text' | 'options'>,
  knownFacts: AdvisorKnownFacts,
  answers: Record<string, string> = {}
) {
  const slot = identifyQuestionSlot(question);
  if (!slot) {
    return !answers[question.id];
  }

  if (slot === 'useCases' || slot === 'integrations') {
    return !knownFacts[slot] || knownFacts[slot]!.length === 0;
  }

  return !knownFacts[slot];
}

export function knownFactsToAnswers(
  facts: AdvisorKnownFacts
): Record<string, string> {
  const answers: Record<string, string> = {};

  if (facts.teamSize) answers['team-size'] = facts.teamSize;
  if (facts.budget) answers['budget'] = facts.budget;
  if (facts.urgency) answers['urgency'] = facts.urgency;
  if (facts.companyStage) answers['company-stage'] = facts.companyStage;
  if (facts.useCases && facts.useCases.length > 0) {
    answers['use-cases'] = facts.useCases.join(', ');
  }
  if (facts.integrations && facts.integrations.length > 0) {
    answers.integrations = facts.integrations.join(', ');
  }
  if (facts.constraints && facts.constraints.length > 0) {
    answers.constraints = facts.constraints.join(', ');
  }
  if (facts.rejectedProducts && facts.rejectedProducts.length > 0) {
    answers.rejectedProducts = facts.rejectedProducts.join(', ');
  }

  return answers;
}

export function updateKnownFactsFromAnswer(params: {
  existingFacts?: AdvisorKnownFacts;
  questionId: string;
  answer: string;
  question?: Pick<AdvisorQuestion, 'id' | 'text' | 'options' | 'allowMultiple'>;
  detectedCategory?: string | null;
}) {
  const extractedFromAnswer = extractKnownFacts(
    params.answer,
    params.detectedCategory
  );
  const normalizedAnswer = params.answer.trim();
  const values = splitMultiValueAnswer(normalizedAnswer);
  const inferred: AdvisorKnownFacts = {};

  switch (params.questionId) {
    case 'team-size':
    case 'q1':
      inferred.teamSize = normalizedAnswer;
      break;
    case 'budget':
    case 'q2':
      inferred.budget = normalizedAnswer;
      break;
    case 'urgency':
    case 'q3':
      inferred.urgency = normalizedAnswer;
      break;
    case 'company-stage':
    case 'q4':
      inferred.companyStage = normalizedAnswer;
      break;
    default: {
      const slot = params.question
        ? identifyQuestionSlot(params.question)
        : identifyQuestionSlot({
            id: params.questionId,
            text: params.questionId,
            options: [],
          });

      if (slot === 'integrations') {
        inferred.integrations = values;
      } else if (slot === 'useCases') {
        inferred.useCases = values;
      }
      break;
    }
  }

  return mergeKnownFacts(
    params.existingFacts,
    mergeKnownFacts(extractedFromAnswer, inferred)
  );
}

export function filterRedundantQuestions(
  questions: AdvisorQuestion[],
  knownFacts: AdvisorKnownFacts,
  answers: Record<string, string> = {}
): AdvisorQuestion[] {
  return questions.filter((question) =>
    shouldAskQuestion(question, knownFacts, answers)
  );
}

export function isQuestionAnswered(
  question: AdvisorQuestion,
  knownFacts: AdvisorKnownFacts
) {
  const slot = identifyQuestionSlot(question);
  if (!slot) return false;

  if (slot === 'useCases' || slot === 'integrations') {
    return Boolean(knownFacts[slot] && knownFacts[slot]!.length > 0);
  }

  return Boolean(knownFacts[slot]);
}

export function identifyQuestionSlot(
  question: Pick<AdvisorQuestion, 'id' | 'text' | 'options'>
): keyof AdvisorKnownFacts | null {
  const id = question.id.toLowerCase();
  const text = question.text.toLowerCase();
  const optionsText = question.options.join(' ').toLowerCase();
  const combined = `${id} ${text} ${optionsText}`;

  if (/team size|how many team|how many employees|how many users/.test(combined)) {
    return 'teamSize';
  }

  if (/budget|price range|spend|cost/.test(combined) || /month|inr|usd|\$|rs\b|rupees?/.test(combined)) {
    return 'budget';
  }

  if (/urgently|timeline|how soon|when do you need|implementation/.test(combined)) {
    return 'urgency';
  }

  if (/company stage|business stage|maturity|startup|enterprise/.test(combined)) {
    return 'companyStage';
  }

  if (/integration|connect with|works with|sync with|bank feeds|payment gateways/.test(combined)) {
    return 'integrations';
  }

  if (/use case|primary need|primary goal|goal|outcome|priority|challenge|pain|automation|workflow/.test(combined)) {
    return 'useCases';
  }

  return null;
}

function extractCategory(problem: string) {
  const normalized = problem.toLowerCase();

  if (/payroll/.test(normalized)) return 'payroll';
  if (/account|invoice|bookkeep|tax|finance|billing/.test(normalized)) return 'accounting';
  if (/crm|lead|sales pipeline|follow-up|customer relationship/.test(normalized)) return 'crm';
  if (/project|task|workflow/.test(normalized)) return 'project-management';
  if (/marketing|campaign|email automation|social/.test(normalized)) return 'marketing';

  return undefined;
}

function extractTeamSize(problem: string) {
  const normalized = problem.toLowerCase();

  const directNumberMatch =
    normalized.match(/team size (?:of|is)?\s*(\d{1,4})/) ||
    normalized.match(/team of\s*(\d{1,4})/) ||
    normalized.match(/(\d{1,4})[-\s]person\b/) ||
    normalized.match(/(\d{1,4})\s*(people|employees|users|staff|team members?|person company)/);

  if (directNumberMatch) {
    return formatTeamSizeRange(Number(directNumberMatch[1]));
  }

  if (/\bsmall company\b|\bsmall business\b/.test(normalized)) {
    return '6-20 people';
  }

  return undefined;
}

function extractBudget(problem: string) {
  const normalized = problem.replace(/\s+/g, ' ').trim();
  const rangeMatch =
    normalized.match(/((?:under|below|less than|up to)\s+(?:inr|usd|eur|gbp|rs\.?)?\s?[\d,]+(?:\s*\/?\s*(?:month|monthly))?)/i) ||
    normalized.match(/((?:inr|usd|eur|gbp|rs\.?)\s?[\d,]+(?:\s*-\s*(?:inr|usd|eur|gbp|rs\.?)?\s?[\d,]+)?(?:\s*\/?\s*(?:month|monthly))?)/i) ||
    normalized.match(/((?:[$€£₹]|rs\.?)\s?[\d,.\s]+(?:\s?-\s?(?:[$€£₹]|rs\.?)?\s?[\d,.]+)?(?:\s*(?:per month|monthly|\/month))?)/i) ||
    normalized.match(/(\d+\s*(?:lakh|lakhs|crore|crores))/i);

  return rangeMatch?.[1]?.trim();
}

function extractUrgency(problem: string) {
  const normalized = problem.toLowerCase();

  if (/\basap\b|\bimmediately\b|\burgent\b|\bright away\b/.test(normalized)) {
    return 'Immediate (within 1 month)';
  }

  if (/within\s+(\d+)\s*(day|days|week|weeks|month|months)/.test(normalized)) {
    return problem.match(/within\s+\d+\s*(?:day|days|week|weeks|month|months)/i)?.[0];
  }

  return undefined;
}

function extractCompanyStage(problem: string) {
  const normalized = problem.toLowerCase();

  if (/\bsmall company\b|\bsmall business\b/.test(normalized)) {
    return 'Small business';
  }

  if (/\bstartup\b|\bseed\b/.test(normalized)) {
    return 'Early startup (Seed)';
  }

  if (/\bgrowth\b|\bseries a\b|\bseries b\b/.test(normalized)) {
    return 'Growing company';
  }

  if (/\benterprise\b/.test(normalized)) {
    return 'Enterprise';
  }

  return undefined;
}

function extractUseCases(problem: string) {
  const normalized = problem.toLowerCase();
  const matches = new Set<string>();

  const patterns = [
    /need (?:a|an)?\s*[^.?!,]*?\s+for\s+([^.?!]+)/i,
    /looking for\s+[^.?!,]*?\s+to\s+([^.?!]+)/i,
    /want to\s+([^.?!]+)/i,
    /need to\s+([^.?!]+)/i,
    /struggle to\s+([^.?!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = problem.match(pattern);
    if (match?.[1]) {
      matches.add(cleanFactPhrase(match[1]));
    }
  }

  if (/payroll/.test(normalized)) matches.add('payroll management');
  if (/follow-up|follow up/.test(normalized)) matches.add('follow-up automation');
  if (/lead/.test(normalized)) matches.add('lead tracking');
  if (/invoice/.test(normalized)) matches.add('invoicing');

  return Array.from(matches).filter(Boolean);
}

function extractIntegrations(problem: string) {
  const normalized = problem.toLowerCase();
  const matches = new Set<string>();

  for (const integration of COMMON_INTEGRATIONS) {
    if (normalized.includes(integration)) {
      matches.add(formatIntegrationName(integration));
    }
  }

  const explicitIntegrationMatch = problem.match(
    /(?:integrate with|connect with|sync with|works with)\s+([^.?!]+)/i
  );
  if (explicitIntegrationMatch?.[1]) {
    splitMultiValueAnswer(explicitIntegrationMatch[1]).forEach((item) =>
      matches.add(item)
    );
  }

  return Array.from(matches).filter(Boolean);
}

function splitMultiValueAnswer(answer: string) {
  return answer
    .split(/,|\/| and /i)
    .map((item) => cleanFactPhrase(item))
    .filter(Boolean);
}

function cleanFactPhrase(value: string) {
  return value
    .replace(/^(for|to|our|the)\s+/i, '')
    .replace(/\b(with|using)\b.*$/i, '')
    .replace(/[.?!]$/g, '')
    .trim();
}

function formatIntegrationName(value: string) {
  if (value === 'gmail') return 'Gmail';
  if (value === 'google workspace') return 'Google Workspace';
  if (value === 'outlook') return 'Outlook';
  if (value === 'microsoft 365') return 'Microsoft 365';
  if (value === 'slack') return 'Slack';
  if (value === 'zapier') return 'Zapier';
  if (value === 'shopify') return 'Shopify';
  if (value === 'woocommerce') return 'WooCommerce';
  if (value === 'quickbooks') return 'QuickBooks';
  if (value === 'xero') return 'Xero';
  if (value === 'paypal') return 'PayPal';
  if (value === 'stripe') return 'Stripe';
  if (value === 'whatsapp') return 'WhatsApp';
  if (value === 'hubspot') return 'HubSpot';
  if (value === 'salesforce') return 'Salesforce';
  return value;
}

function formatTeamSizeRange(size: number) {
  if (size <= 5) return '1-5 people';
  if (size <= 20) return '6-20 people';
  if (size <= 50) return '21-50 people';
  if (size <= 100) return '51-100 people';
  return '100+ people';
}
