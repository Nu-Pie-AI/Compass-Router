// ============================================
// AI ADVISOR OPENAI CLIENT WRAPPER
// ============================================

import OpenAI from 'openai';
import {
  AdvisorKnownFacts,
  AdvisorQuestion,
  ScoredOffering,
  AdvisorOfferingData,
  AISolution,
} from './types';
import {
  buildIntentAnalysisPrompt,
  buildQuestionGenerationPrompt,
  buildBatchUseCaseSimilarityPrompt,
  buildBatchReasoningPrompt,
  buildSolutionGenerationPrompt,
  extractUseCases,
} from './prompts';
import { filterRedundantQuestions, knownFactsToAnswers } from './facts';
import { localizeBudgetQuestion, resolveCurrencyContext } from './locale';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = 'gpt-4o-mini'; // Fast and cost-effective
const REASONING_MODEL = 'gpt-4o'; // More capable for complex reasoning

/**
 * Parse JSON from OpenAI response with error handling
 */
function parseJSON<T>(content: string, fallback: T): T {
  try {
    // Remove markdown code blocks if present
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('Failed to parse OpenAI JSON response:', error);
    console.error('Raw content:', content);
    return fallback;
  }
}

/**
 * Analyze user's problem to detect category and intent
 */
export async function analyzeIntent(
  problemDescription: string
): Promise<{
  detectedCategory: string;
  detectedIntent: string;
  confidence: number;
}> {
  const prompt = buildIntentAnalysisPrompt(problemDescription);

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low temperature for consistent categorization
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = parseJSON<{
      detectedCategory: string;
      detectedIntent: string;
      confidence: number;
    }>(content, {
      detectedCategory: 'general', // Will be validated by category-validator
      detectedIntent: 'General business needs',
      confidence: 0.3, // Lower confidence for fallback
    });

    return parsed;
  } catch (error) {
    console.error('OpenAI intent analysis error:', error);
    throw new Error('Failed to analyze intent');
  }
}

/**
 * Get category-specific fallback question
 */
function getCategorySpecificQuestion(category: string): AdvisorQuestion {
  const categoryQuestions: Record<string, AdvisorQuestion> = {
    crm: {
      id: 'q3',
      text: 'What is your primary CRM use case?',
      options: [
        'Lead tracking and management',
        'Sales pipeline management',
        'Customer service and support',
        'Marketing automation',
        'All of the above',
      ],
      allowMultiple: true,
    },
    'project-management': {
      id: 'q3',
      text: 'What type of projects do you primarily manage?',
      options: [
        'Software development',
        'Marketing campaigns',
        'Construction/Field work',
        'Creative/Design projects',
        'General business projects',
      ],
      allowMultiple: true,
    },
    marketing: {
      id: 'q3',
      text: 'What is your primary marketing focus?',
      options: [
        'Email marketing',
        'Social media management',
        'Content marketing',
        'SEO and analytics',
        'Multi-channel campaigns',
      ],
      allowMultiple: true,
    },
    'e-commerce': {
      id: 'q3',
      text: 'What is your primary ecommerce need?',
      options: [
        'Online store setup',
        'Inventory management',
        'Payment processing',
        'Multi-channel selling',
        'All of the above',
      ],
      allowMultiple: true,
    },
    analytics: {
      id: 'q3',
      text: 'What data insights are you looking for?',
      options: [
        'Website traffic and user behavior',
        'Sales and revenue analytics',
        'Customer segmentation',
        'Marketing campaign performance',
        'Business intelligence dashboards',
      ],
      allowMultiple: true,
    },
    communication: {
      id: 'q3',
      text: 'What is your main communication challenge?',
      options: [
        'Team collaboration',
        'Video conferencing',
        'Internal messaging',
        'Customer communication',
        'All of the above',
      ],
      allowMultiple: true,
    },
  };

  // Return category-specific question or generic fallback
  return (
    categoryQuestions[category] || {
      id: 'q3',
      text: 'What is your timeline for implementation?',
      options: [
        'Immediate (this week)',
        'Short-term (1-4 weeks)',
        'Medium-term (1-3 months)',
        'Long-term planning (3+ months)',
        'Just exploring options',
      ],
      allowMultiple: false,
    }
  );
}

/**
 * Get improved fallback questions with category-specific question
 */
function getFallbackQuestions(
  category: string,
  acceptLanguageHeader?: string | null
): AdvisorQuestion[] {
  const currencyContext = resolveCurrencyContext(acceptLanguageHeader);
  const commonQuestions: AdvisorQuestion[] = [
    {
      id: 'q1',
      text: 'What is your team size?',
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
      id: 'q2',
      text: 'What is your monthly budget for this solution?',
      options: currencyContext.monthlyBudgetOptions,
      allowMultiple: false,
    },
  ];

  const categorySpecificQuestion = getCategorySpecificQuestion(category);

  return [...commonQuestions, categorySpecificQuestion];
}

/**
 * Generate clarifying questions based on problem and provider qualifying questions
 */
export async function generateQuestions(
  problemDescription: string,
  detectedCategory: string,
  providerQualifyingQuestions: string[],
  acceptLanguageHeader?: string | null,
  knownFacts?: AdvisorKnownFacts
): Promise<AdvisorQuestion[]> {
  const currencyContext = resolveCurrencyContext(acceptLanguageHeader);
  const prompt = buildQuestionGenerationPrompt(
    problemDescription,
    detectedCategory,
    providerQualifyingQuestions,
    knownFacts ? knownFactsToAnswers(knownFacts) : undefined,
    currencyContext
  );

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const questions = parseJSON<AdvisorQuestion[]>(content, [
      {
        id: 'q1',
        text: 'What is your team size?',
        options: ['1-5 people', '6-20 people', '21-50 people', '51+ people'],
        allowMultiple: false,
      },
      {
        id: 'q2',
        text: 'What is your monthly budget?',
        options: currencyContext.monthlyBudgetOptions,
        allowMultiple: false,
      },
      {
        id: 'q3',
        text: 'How urgent is this need?',
        options: [
          'Need it this week',
          'Within a month',
          'Within 3 months',
          'Just exploring',
        ],
        allowMultiple: false,
      },
    ]);

    return filterRedundantQuestions(
      questions.map((question) => localizeBudgetQuestion(question, currencyContext)),
      knownFacts || {}
    );
  } catch (error) {
    console.error('OpenAI question generation error:', error);
    // Return improved fallback questions with category-specific question
    return filterRedundantQuestions(
      getFallbackQuestions(detectedCategory, acceptLanguageHeader),
      knownFacts || {}
    );
  }
}

/**
 * Calculate use case similarity scores for multiple offerings
 * Returns a map of offeringId -> similarity score (0-1)
 */
export async function calculateUseCaseSimilarity(
  userProblem: string,
  offerings: AdvisorOfferingData[]
): Promise<Map<string, number>> {
  const offeringData = offerings.map((o) => ({
    id: o.id,
    name: o.title,
    useCases: extractUseCases(o),
  }));

  const prompt = buildBatchUseCaseSimilarityPrompt(userProblem, offeringData);

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = parseJSON<{ scores: Record<string, number> }>(content, {
      scores: {},
    });

    // Convert to Map
    const scoresMap = new Map<string, number>();
    Object.entries(parsed.scores).forEach(([id, score]) => {
      scoresMap.set(id, score);
    });

    return scoresMap;
  } catch (error) {
    console.error('OpenAI use case similarity error:', error);
    // Return empty map as fallback (scoring will work without it)
    return new Map();
  }
}

/**
 * Generate reasoning explanations for top recommendations
 * Returns a map of offeringId -> reasoning text
 */
export async function generateRecommendationReasons(
  userProblem: string,
  userAnswers: Record<string, string>,
  topOfferings: ScoredOffering[]
): Promise<Map<string, string>> {
  const prompt = buildBatchReasoningPrompt(
    userProblem,
    userAnswers,
    topOfferings
  );

  try {
    const response = await openai.chat.completions.create({
      model: REASONING_MODEL, // Use more capable model for better explanations
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Higher temperature for more natural language
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = parseJSON<Record<string, string>>(content, {});

    // Convert to Map
    const reasonsMap = new Map<string, string>();
    Object.entries(parsed).forEach(([id, reason]) => {
      reasonsMap.set(id, reason);
    });

    return reasonsMap;
  } catch (error) {
    console.error('OpenAI reasoning generation error:', error);
    // Return fallback generic reasons
    const fallbackMap = new Map<string, string>();
    topOfferings.forEach((so) => {
      fallbackMap.set(
        so.offering.id,
        `${so.offering.title} scored ${so.matchScore}/100 based on category match, pricing alignment, and user ratings. ${so.offering.shortDescription}`
      );
    });
    return fallbackMap;
  }
}

/**
 * Generate AI solution (generic, no brand names)
 *
 * Uses GPT-4o for higher quality output
 * Returns a structured solution with actionable steps
 */
export async function generateSolution(
  problem: string,
  category: string,
  answers: Record<string, string>,
  detectedIntent: string
): Promise<AISolution> {
  const prompt = buildSolutionGenerationPrompt(
    problem,
    category,
    answers,
    detectedIntent
  );

  try {
    const response = await openai.chat.completions.create({
      model: REASONING_MODEL, // Use GPT-4o for better quality
      messages: [
        {
          role: 'system',
          content:
            'You are a business consultant providing generic solutions. NEVER mention brand names. Always return valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7, // Balanced creativity
      max_tokens: 800, // Enough for 500 words
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse JSON response
    const solution = parseJSON<AISolution>(content, {
      summary: 'Failed to generate solution',
      actionableSteps: [],
      toolTypesNeeded: [],
      estimatedImplementationTime: 'Unknown',
      budgetConsiderations: 'Unknown',
    });

    // Validate solution structure
    if (
      !solution.summary ||
      !Array.isArray(solution.actionableSteps) ||
      solution.actionableSteps.length === 0
    ) {
      throw new Error('Invalid solution structure from OpenAI');
    }

    return solution;
  } catch (error) {
    console.error('OpenAI solution generation error:', error);
    throw error; // Re-throw to allow endpoint to use fallback
  }
}

/**
 * Health check - verify OpenAI API key is configured
 */
export function checkOpenAIConfig(): boolean {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is not set');
    return false;
  }
  return true;
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
  if (!checkOpenAIConfig()) return false;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    });

    return response.choices[0]?.message?.content?.includes('OK') || false;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}
