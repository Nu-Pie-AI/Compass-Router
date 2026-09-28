// ============================================
// QUESTIONNAIRE PARSER
// Transforms 37-question questionnaire answers into Offering database fields
// ============================================

import { EnrichmentQA, ParsedOfferingData } from './types';

export function parseQuestionnaireToOffering(
  answersText: string,
  offeringName: string,
  offeringSummary: string
): ParsedOfferingData {
  const q1 = extractAnswer(answersText, 'Q1');
  const q2 = extractAnswer(answersText, 'Q2');
  const q3a = extractAnswer(answersText, 'Q3a');
  const q3b = extractAnswer(answersText, 'Q3b');
  const q3c = extractAnswer(answersText, 'Q3c');
  const q3d = extractAnswer(answersText, 'Q3d');
  const q3f = extractAnswer(answersText, 'Q3f');
  const q5 = extractAnswer(answersText, 'Q5');
  const q7 = extractAnswer(answersText, 'Q7');
  const q10 = extractAnswer(answersText, 'Q10');
  const q11 = extractAnswer(answersText, 'Q11');
  const q12 = extractAnswer(answersText, 'Q12');
  const q13 = extractAnswer(answersText, 'Q13');
  const q15 = extractAnswer(answersText, 'Q15');
  const q16 = extractAnswer(answersText, 'Q16');
  const q21 = extractAnswer(answersText, 'Q21');
  const q22 = extractAnswer(answersText, 'Q22');
  const q23 = extractAnswer(answersText, 'Q23');
  const q24 = extractAnswer(answersText, 'Q24');
  const q25 = extractAnswer(answersText, 'Q25');
  const q26 = extractAnswer(answersText, 'Q26');
  const q28 = extractAnswer(answersText, 'Q28');
  const q29 = extractAnswer(answersText, 'Q29');
  const q32 = extractAnswer(answersText, 'Q32');

  const primaryFunction = parsePrimaryFunction(q1);
  const useCases = buildUseCases(q2, q11, offeringSummary);
  const painPointsSolved = parsePainPoints(q7);
  const icpIndustry = parseIndustries(q3a);
  const icpTeamSize = parseTeamSize(q3b);
  const icpBudget = parseBudget(q3c);
  const icpCompanyStage = parseCompanyStage(q3d);
  const regions = parseRegions(q3f);
  const integrations = parseIntegrations(q16);
  const complianceFlags = parseCompliance(q21, q22, q23, q24, q25, q26);
  const pricingModel = parsePricingModel(q28);
  const startingPrice = parseStartingPrice(answersText, offeringSummary, q28, q29);
  const hasFreeTrial = parseHasFreeTrial(answersText, offeringSummary, q28, q29);
  const implementationTime = parseImplementationTime(q32, q10, offeringSummary);
  const learningCurve = parseLearningCurve(q10, q15, implementationTime);
  const offeringType = inferOfferingType(q1, q13);
  const description = buildDescription(q2, q5, q11, q12, offeringSummary);
  const confidenceScore = calculateConfidence(answersText);

  return {
    title: offeringName,
    shortDescription: offeringSummary,
    description,
    offeringType,
    primaryFunction,
    useCases,
    painPointsSolved,
    icpTeamSize,
    icpIndustry,
    icpCompanyStage,
    icpBudget,
    integrations,
    complianceFlags,
    pricingModel,
    startingPrice,
    hasFreeTrial,
    implementationTime,
    learningCurve,
    regions,
    confidenceScore,
  };
}

export function extractEnrichmentQA(answersText: string): EnrichmentQA[] {
  const qaList: EnrichmentQA[] = [];

  const questionIds = [
    'Q1',
    'Q2',
    'Q3a',
    'Q3b',
    'Q3c',
    'Q3d',
    'Q3e',
    'Q3f',
    'Q4a',
    'Q4b',
    'Q5',
    'Q6',
    'Q7',
    'Q8',
    'Q9',
    'Q10',
    'Q11',
    'Q12',
    'Q13',
    'Q15',
    'Q16',
    'Q17',
    'Q18',
    'Q19',
    'Q20',
    'Q21',
    'Q22',
    'Q22b',
    'Q23',
    'Q24',
    'Q25',
    'Q26',
    'Q27',
    'Q28',
    'Q29',
    'Q30',
    'Q31',
    'Q32',
    'Q33',
    'Q34',
    'Q35',
    'Q36',
    'Q37',
  ];

  questionIds.forEach((questionId) => {
    const questionText = extractQuestionText(answersText, questionId);
    const answer = extractAnswer(answersText, questionId);

    if (questionText && answer) {
      qaList.push({
        questionId,
        question: questionText,
        answer,
        confidence: answer === 'Unknown' ? 0 : 80,
      });
    }
  });

  return qaList;
}

function extractAnswer(answersText: string, questionId: string): string {
  const block = extractQuestionBlock(answersText, questionId);
  const match = block?.match(/Answer:\s*([\s\S]*?)(?=\n\s*---|$)/i);

  if (match?.[1]) {
    const answer = match[1].trim();
    if (answer && answer.toLowerCase() !== 'unknown') {
      return answer;
    }
  }

  return 'Unknown';
}

function extractQuestionText(answersText: string, questionId: string): string {
  const heading = extractQuestionHeading(answersText, questionId);
  return heading || `Question ${questionId}`;
}

function extractQuestionBlock(
  answersText: string,
  questionId: string
): string | null {
  const pattern = new RegExp(
    `(?:^|\\n)(?:#+\\s*)?${escapeQuestionId(questionId)}(?:\\)|\\b)\\s*[^\\n]*\\n([\\s\\S]*?)(?=\\n(?:#+\\s*)?Q\\d+[a-z]?(?:\\)|\\b)|\\nMISSING|\\nCOMPLETE|$)`,
    'i'
  );

  return answersText.match(pattern)?.[1] || null;
}

function extractQuestionHeading(
  answersText: string,
  questionId: string
): string | null {
  const pattern = new RegExp(
    `(?:^|\\n)(?:#+\\s*)?${escapeQuestionId(questionId)}(?:\\)|\\b)\\s*([^\\n]*)`,
    'i'
  );

  const match = answersText.match(pattern);
  return match?.[1]?.trim() || null;
}

function escapeQuestionId(questionId: string): string {
  return questionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePrimaryFunction(q1Answer: string): string {
  if (!q1Answer || q1Answer === 'Unknown') {
    return 'others';
  }

  const lowerAnswer = normalizeText(q1Answer).toLowerCase();

  const categoryMap: Record<string, string> = {
    crm: 'crm',
    'customer relationship': 'crm',
    accounting: 'accounting',
    finance: 'accounting',
    hrtech: 'hrtech',
    'human resources': 'hrtech',
    marketing: 'marketing',
    'it services': 'it-services',
    cybersecurity: 'cybersecurity',
    security: 'cybersecurity',
    erp: 'erp',
    inventory: 'inventory',
    procurement: 'procurement',
    projects: 'project-management',
    'project management': 'project-management',
    'field work': 'field-workforce',
    management: 'management',
    helpdesk: 'helpdesk',
    'bi and data': 'bi-analytics',
    analytics: 'bi-analytics',
    mdm: 'mdm',
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lowerAnswer.includes(keyword)) {
      return category;
    }
  }

  return 'others';
}

function parseUseCases(q2Answer: string): string[] {
  if (!q2Answer || q2Answer === 'Unknown' || isWeakParsedAnswer(q2Answer)) {
    return [];
  }

  return splitListLikeAnswer(q2Answer).filter((line) => line.length > 10).slice(0, 5);
}

function parsePainPoints(q7Answer: string): string[] {
  if (!q7Answer || q7Answer === 'Unknown') {
    return [];
  }

  const outcomeMap: Record<string, string> = {
    'time saved': 'Manual, time-consuming processes',
    accuracy: 'Errors and inaccuracies in data',
    'margin improvement': 'Low profit margins',
    productivity: 'Low team productivity',
    'stock-outs': 'Inventory management challenges',
    'faster closing': 'Slow sales cycles',
  };

  const painPoints: string[] = [];
  const lowerAnswer = normalizeText(q7Answer).toLowerCase();

  for (const [outcome, painPoint] of Object.entries(outcomeMap)) {
    if (lowerAnswer.includes(outcome)) {
      painPoints.push(painPoint);
    }
  }

  return painPoints.length > 0
    ? painPoints
    : ['Operational inefficiencies', 'Manual processes'];
}

function parseIndustries(q3aAnswer: string): string[] {
  if (!q3aAnswer || q3aAnswer === 'Unknown') {
    return [];
  }

  return splitListLikeAnswer(q3aAnswer);
}

function parseTeamSize(q3bAnswer: string): string | undefined {
  if (!q3bAnswer || q3bAnswer === 'Unknown') {
    return undefined;
  }

  const normalized = normalizeText(q3bAnswer);
  const lowerAnswer = normalized.toLowerCase();

  const sizeMap: Record<string, string> = {
    '1-10': '1-10 people',
    micro: '1-10 people',
    '11-50': '11-50 people',
    small: '11-50 people',
    '51-200': '51-200 people',
    'lower mid': '51-200 people',
    '201-500': '201-500 people',
    mid: '201-500 people',
    '501-1,000': '501-1,000 people',
    'upper mid': '501-1,000 people',
    '1001-5000': '1,001-5,000 people',
    '1,001-5,000': '1,001-5,000 people',
    'enterprise-lite': '1,001-5,000 people',
    '5000+': '5,000+ people',
    '5,000+': '5,000+ people',
    enterprise: '5,000+ people',
  };

  for (const [keyword, size] of Object.entries(sizeMap)) {
    if (lowerAnswer.includes(keyword)) {
      return size;
    }
  }

  return normalized;
}

function parseBudget(q3cAnswer: string): string | undefined {
  if (!q3cAnswer || q3cAnswer === 'Unknown') {
    return undefined;
  }

  const normalized = normalizeCurrencyText(q3cAnswer);
  const lowerAnswer = normalized.toLowerCase();

  if (lowerAnswer.startsWith('< inr')) {
    return normalized.replace(/^<\s*/i, 'Under ');
  }

  if (lowerAnswer.includes('crore') || lowerAnswer.includes('cr')) {
    return normalized
      .replace(/\bcrore\b/gi, 'Cr')
      .replace(/\bcr\b/gi, 'Cr')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (lowerAnswer.includes('lakh') || lowerAnswer.includes('lac')) {
    return normalized
      .replace(/\blac\b/gi, 'lakh')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return normalized;
}

function parseCompanyStage(q3dAnswer: string): string | undefined {
  if (!q3dAnswer || q3dAnswer === 'Unknown') {
    return undefined;
  }

  return normalizeText(q3dAnswer);
}

function parseRegions(q3fAnswer: string): string[] {
  if (!q3fAnswer || q3fAnswer === 'Unknown') {
    return ['India'];
  }

  const regions = splitListLikeAnswer(q3fAnswer);
  return regions.length > 0 ? regions : ['India'];
}

function parseIntegrations(q16Answer: string): string[] {
  if (!q16Answer || q16Answer === 'Unknown') {
    return [];
  }

  return splitListLikeAnswer(q16Answer);
}

function buildUseCases(q2Answer: string, q11Answer: string, summary: string): string[] {
  const directUseCases = parseUseCases(q2Answer);
  if (directUseCases.length > 0) {
    return directUseCases;
  }

  const featureFallback = parseListAnswer(q11Answer);
  if (featureFallback.length > 0) {
    return featureFallback.map((feature) => `${feature} for SMB teams`);
  }

  return normalizeText(summary)
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20)
    .slice(0, 3);
}

function parseListAnswer(answer: string): string[] {
  if (!answer || answer === 'Unknown' || isWeakParsedAnswer(answer)) {
    return [];
  }

  return splitListLikeAnswer(answer).slice(0, 5);
}

function isWeakParsedAnswer(answer: string): boolean {
  return /^(see above|same as above|as above|n\/a|na|none|---)\b/i.test(
    answer.trim()
  );
}

function parseCompliance(
  _q21: string,
  _q22: string,
  _q23: string,
  q24: string,
  q25: string,
  q26: string
): string[] {
  const flags: string[] = [];

  if (q24 && q24 !== 'Unknown') {
    const lowerQ24 = normalizeText(q24).toLowerCase();
    if (lowerQ24.includes('iso 27001')) flags.push('ISO 27001');
    if (lowerQ24.includes('soc2') || lowerQ24.includes('soc 2')) flags.push('SOC2');
    if (lowerQ24.includes('gdpr')) flags.push('GDPR');
    if (lowerQ24.includes('hipaa')) flags.push('HIPAA');
  }

  if (q25 && q25.toLowerCase() === 'yes') {
    flags.push('Data Encryption');
  }

  if (q26 && q26.toLowerCase() === 'yes') {
    flags.push('Audit Logs');
  }

  return flags;
}

function parsePricingModel(q28Answer: string): string | undefined {
  if (!q28Answer || q28Answer === 'Unknown') {
    return undefined;
  }

  const lowerAnswer = normalizeText(q28Answer).toLowerCase();

  if (lowerAnswer.includes('per user') || lowerAnswer.includes('per seat')) return 'per-seat';
  if (lowerAnswer.includes('per transaction') || lowerAnswer.includes('pay as you go')) {
    return 'per-usage';
  }
  if (lowerAnswer.includes('per module') || lowerAnswer.includes('enterprise quote')) {
    return 'custom';
  }
  if (lowerAnswer.includes('freemium') || lowerAnswer.includes('free plan')) return 'freemium';
  if (lowerAnswer.includes('free')) return 'freemium';

  return 'paid';
}

function parseStartingPrice(
  answersText: string,
  offeringSummary: string,
  q28Answer: string,
  q29Answer: string
): number | undefined {
  const priceSources = [q29Answer, q28Answer, offeringSummary, answersText];

  for (const source of priceSources) {
    const amount = extractFirstCurrencyAmount(source);
    if (amount !== undefined) {
      return amount;
    }
  }

  return undefined;
}

function parseHasFreeTrial(
  answersText: string,
  offeringSummary: string,
  q28Answer: string,
  q29Answer: string
): boolean {
  const freeTrialText = [offeringSummary, q28Answer, q29Answer, answersText]
    .map((value) => normalizeText(value || ''))
    .join(' ')
    .toLowerCase();

  if (/\bno free trial\b|\bno trial\b/.test(freeTrialText)) {
    return false;
  }

  return /\bfree trial\b|\btrial\b|\bfreemium\b|\bfree plan\b/.test(freeTrialText);
}

function parseImplementationTime(
  q32Answer: string,
  q10Answer: string,
  offeringSummary: string
): string | undefined {
  const combined = [q32Answer, q10Answer, offeringSummary]
    .map((value) => normalizeText(value || ''))
    .join(' ')
    .toLowerCase();

  if (!combined.trim()) {
    return undefined;
  }

  if (
    /same day|same-day|within a day|one day|1 day|few hours|hours|instant|immediate/.test(
      combined
    )
  ) {
    return '1 day';
  }

  if (/1 week|one week|within a week|days|2 weeks?|two weeks?/.test(combined)) {
    return '1 week';
  }

  if (/3\+?\s*months|three months|quarter|12 weeks|8 weeks|multi-month/.test(combined)) {
    return '3+ months';
  }

  if (/weeks?|month|4 weeks|30 days|guided onboarding|configuration/.test(combined)) {
    return '1 month';
  }

  if (/self-serve|minimal setup|plug and play/.test(combined)) {
    return '1 week';
  }

  if (/complex|custom implementation|partner-led|enterprise rollout/.test(combined)) {
    return '3+ months';
  }

  return undefined;
}

function parseLearningCurve(
  q10Answer: string,
  q15Answer: string,
  implementationTime?: string
): string | undefined {
  const combined = [q10Answer, q15Answer]
    .map((value) => normalizeText(value || ''))
    .join(' ')
    .toLowerCase();

  if (
    /self-serve|intuitive|minimal training|easy to learn|plug and play|low onboarding effort/.test(
      combined
    )
  ) {
    return 'low';
  }

  if (
    /guided onboarding|some configuration|moderate|admin setup|training session/.test(
      combined
    )
  ) {
    return 'medium';
  }

  if (
    /high touch|complex|consulting|enterprise implementation|dedicated team|heavy customization/.test(
      combined
    )
  ) {
    return 'high';
  }

  if (implementationTime === '1 day' || implementationTime === '1 week') {
    return 'low';
  }
  if (implementationTime === '1 month') {
    return 'medium';
  }
  if (implementationTime === '3+ months') {
    return 'high';
  }

  return undefined;
}

function inferOfferingType(
  q1Answer: string,
  q13Answer: string
): 'PRODUCT' | 'SERVICE' | 'IMPLEMENTATION' | 'TRAINING' | 'MANAGED_SERVICE' {
  if (q13Answer && q13Answer !== 'Unknown') {
    const lowerQ13 = normalizeText(q13Answer).toLowerCase();
    if (lowerQ13.includes('saas') || lowerQ13.includes('on-prem')) {
      return 'PRODUCT';
    }
  }

  if (q1Answer) {
    const lowerQ1 = normalizeText(q1Answer).toLowerCase();
    if (lowerQ1.includes('consulting') || lowerQ1.includes('professional service')) {
      return 'SERVICE';
    }
    if (lowerQ1.includes('training')) return 'TRAINING';
    if (lowerQ1.includes('managed')) return 'MANAGED_SERVICE';
    if (lowerQ1.includes('implementation')) return 'IMPLEMENTATION';
  }

  return 'PRODUCT';
}

function buildDescription(
  q2: string,
  q5: string,
  q11: string,
  q12: string,
  summary: string
): string {
  let description = normalizeText(summary) + '\n\n';

  if (q5 && q5 !== 'Unknown') {
    description += `**Ideal For:** ${normalizeText(q5)}\n\n`;
  }

  if (q11 && q11 !== 'Unknown') {
    description += `**Key Features:** ${normalizeText(q11)}\n\n`;
  }

  if (q12 && q12 !== 'Unknown') {
    description += `**Workflow:** ${normalizeText(q12)}\n\n`;
  }

  if (q2 && q2 !== 'Unknown' && !isWeakParsedAnswer(q2)) {
    description += `**Use Cases:**\n${normalizeText(q2)}`;
  }

  return description;
}

function calculateConfidence(answersText: string): number {
  const totalQuestions = 37;
  const unknownCount = (answersText.match(/Answer:\s*Unknown/gi) || []).length;
  const answeredCount = totalQuestions - unknownCount;
  const completionScore = (answeredCount / totalQuestions) * 100;

  const hasPrimaryFunction = !answersText.match(/Q1\).*?Answer:\s*Unknown/i);
  const hasUseCases = !answersText.match(/Q2\).*?Answer:\s*Unknown/i);
  const hasICP = !answersText.match(/Q3[abc]\).*?Answer:\s*Unknown/gi);

  let bonus = 0;
  if (hasPrimaryFunction) bonus += 5;
  if (hasUseCases) bonus += 5;
  if (hasICP) bonus += 5;

  return Math.min(100, Math.round(completionScore + bonus));
}

function splitListLikeAnswer(answer: string): string[] {
  return normalizeText(answer)
    .replace(/^\s*[-*]\s+/gm, '\n')
    .split(/\n|[;,.]\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeText(value: string): string {
  return value
    .replace(/â€¢/g, '•')
    .replace(/â€“|â€”/g, '-')
    .replace(/â‚¹/g, '₹')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCurrencyText(value: string): string {
  return normalizeText(value)
    .replace(/₹/g, 'INR ')
    .replace(/\$/g, 'USD ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/\bUSD\s+USD\b/gi, 'USD')
    .replace(/\bINR\s+INR\b/gi, 'INR')
    .replace(/\bEUR\s+EUR\b/gi, 'EUR')
    .replace(/\bGBP\s+GBP\b/gi, 'GBP')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstCurrencyAmount(source: string): number | undefined {
  if (!source || source === 'Unknown') {
    return undefined;
  }

  const normalized = normalizeCurrencyText(source);
  const patterns = [
    /(?:starting at|starts at|from|priced at|price[:\s]|pricing[:\s]|as low as)\D{0,25}(?:USD|INR|EUR|GBP|AED|SAR|CAD|AUD|SGD|NZD)?\s*([\d,]+(?:\.\d+)?)/i,
    /\b(?:USD|INR|EUR|GBP|AED|SAR|CAD|AUD|SGD|NZD)\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:user|seat|month|year|mo)|per\s+(?:user|seat|month|year)|monthly|annually)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const parsed = Number.parseFloat(match[1].replace(/,/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}
