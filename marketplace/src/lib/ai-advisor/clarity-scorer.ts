/**
 * AI Advisor Clarity Scoring System
 *
 * Calculates how well we understand the user's problem (0-100%)
 * based on 4 components:
 * 1. Problem Specificity (20 pts) - detail level in problem description
 * 2. Category Confidence (20 pts) - confidence in detected category
 * 3. Questions Answered (40 pts) - ratio of answered questions
 * 4. Context Completeness (20 pts) - critical fields filled
 */

import { ClarityScore, ClarityBreakdown } from './types';

// Critical question IDs that must be answered for completeness
const CRITICAL_QUESTION_IDS = ['team-size', 'budget', 'urgency', 'company-stage', 'q1', 'q2', 'q3', 'q4'];

// Keywords that indicate specificity
const SPECIFICITY_INDICATORS = [
  // Numbers and metrics
  /\d+/,
  /\$\d+/,
  /\d+\s*(user|employee|customer|people|team)/i,
  // Time-related
  /month|week|day|year|quarter/i,
  // Business terms
  /revenue|profit|cost|roi|kpi|metric/i,
  // Technical terms
  /api|integration|automation|workflow|crm|erp|saas/i,
];

/**
 * Calculate problem specificity score (0-20 points)
 *
 * Evaluates:
 * - Word count (longer = more specific)
 * - Presence of numbers/metrics
 * - Technical/business terminology
 */
function calculateProblemSpecificity(problem: string): number {
  if (!problem || problem.trim().length === 0) {
    return 0;
  }

  let score = 0;

  // 1. Word count scoring (0-10 pts)
  const wordCount = problem.trim().split(/\s+/).length;
  if (wordCount >= 50) {
    score += 10;
  } else if (wordCount >= 30) {
    score += 8;
  } else if (wordCount >= 20) {
    score += 6;
  } else if (wordCount >= 10) {
    score += 4;
  } else {
    score += 2;
  }

  // 2. Specificity indicators (0-10 pts)
  let indicatorCount = 0;
  for (const pattern of SPECIFICITY_INDICATORS) {
    if (pattern.test(problem)) {
      indicatorCount++;
    }
  }

  // Award points based on indicator presence (max 10 pts)
  if (indicatorCount >= 4) {
    score += 10;
  } else if (indicatorCount >= 3) {
    score += 7;
  } else if (indicatorCount >= 2) {
    score += 5;
  } else if (indicatorCount >= 1) {
    score += 3;
  }

  return Math.min(score, 20);
}

/**
 * Calculate category confidence score (0-20 points)
 *
 * Direct passthrough from intent analysis (0-100 scaled to 0-20)
 */
function calculateCategoryConfidence(confidence: number): number {
  // Scale 0-100 confidence to 0-20 points
  return Math.round((confidence / 100) * 20);
}

/**
 * Calculate questions answered score (0-40 points)
 *
 * Evaluates:
 * - Ratio of answered questions (critical questions weighted more heavily)
 * - At least 3 questions should be answered for good score
 */
function calculateQuestionsAnswered(
  answeredQuestions: Record<string, string>,
  totalQuestionsAsked: number
): number {
  const answeredCount = Object.keys(answeredQuestions).length;

  if (answeredCount === 0 || totalQuestionsAsked === 0) {
    return 0;
  }

  // Base score from ratio (0-30 pts)
  const ratio = answeredCount / Math.max(totalQuestionsAsked, 3);
  let score = Math.round(Math.min(ratio, 1) * 30);

  // Bonus for critical questions (0-10 pts)
  const criticalAnswered = Object.keys(answeredQuestions).filter((qid) =>
    CRITICAL_QUESTION_IDS.includes(qid)
  ).length;

  if (criticalAnswered >= 4) {
    score += 10;
  } else if (criticalAnswered >= 3) {
    score += 7;
  } else if (criticalAnswered >= 2) {
    score += 5;
  } else if (criticalAnswered >= 1) {
    score += 3;
  }

  return Math.min(score, 40);
}

/**
 * Calculate context completeness score (0-20 points)
 *
 * Checks for critical contextual fields:
 * - Team size (5 pts)
 * - Budget (5 pts)
 * - Urgency (5 pts)
 * - Company stage (5 pts)
 */
function calculateContextCompleteness(answeredQuestions: Record<string, string>): number {
  let score = 0;

  // Check for team size indicators
  const hasTeamSize =
    answeredQuestions['team-size'] ||
    answeredQuestions['q1'] ||
    Object.values(answeredQuestions).some((answer) =>
      /\d+\s*(people|employee|user|team)/i.test(answer)
    );

  if (hasTeamSize) {
    score += 5;
  }

  // Check for budget indicators
  const hasBudget =
    answeredQuestions['budget'] ||
    answeredQuestions['q2'] ||
    Object.values(answeredQuestions).some((answer) =>
      /[$€£₹]\s?\d+|\d+\s*(dollar|usd|eur|gbp|inr|aed|sar|lakh)/i.test(answer)
    );

  if (hasBudget) {
    score += 5;
  }

  // Check for urgency indicators
  const hasUrgency =
    answeredQuestions['urgency'] ||
    answeredQuestions['q3'] ||
    Object.values(answeredQuestions).some((answer) =>
      /(urgent|immediate|asap|soon|month|week)/i.test(answer)
    );

  if (hasUrgency) {
    score += 5;
  }

  // Check for company stage indicators
  const hasCompanyStage =
    answeredQuestions['company-stage'] ||
    answeredQuestions['q4'] ||
    Object.values(answeredQuestions).some((answer) =>
      /(startup|seed|series|enterprise|small|medium|large)/i.test(answer)
    );

  if (hasCompanyStage) {
    score += 5;
  }

  return score;
}

/**
 * Identify critical gaps in user context
 */
function identifyCriticalGaps(
  answeredQuestions: Record<string, string>,
  breakdown: ClarityBreakdown
): string[] {
  const gaps: string[] = [];

  // Check team size
  if (
    !answeredQuestions['team-size'] &&
    !answeredQuestions['q1'] &&
    !Object.values(answeredQuestions).some((answer) => /\d+\s*(people|employee)/i.test(answer))
  ) {
    gaps.push('Need team size information');
  }

  // Check budget
  if (
    !answeredQuestions['budget'] &&
    !answeredQuestions['q2'] &&
    !Object.values(answeredQuestions).some((answer) =>
      /[$€£₹]\s?\d+|\d+\s*(usd|eur|gbp|inr|aed|sar|lakh)/i.test(answer)
    )
  ) {
    gaps.push('Need budget information');
  }

  // Check urgency
  if (
    !answeredQuestions['urgency'] &&
    !answeredQuestions['q3'] &&
    !Object.values(answeredQuestions).some((answer) => /(urgent|soon|immediate)/i.test(answer))
  ) {
    gaps.push('Need urgency/timeline information');
  }

  // Check company stage
  if (
    !answeredQuestions['company-stage'] &&
    !answeredQuestions['q4'] &&
    !Object.values(answeredQuestions).some((answer) => /(startup|enterprise|small)/i.test(answer))
  ) {
    gaps.push('Need company stage/maturity information');
  }

  // Check problem specificity
  if (breakdown.problemSpecificity < 10) {
    gaps.push('Problem description needs more detail');
  }

  // Check category confidence
  if (breakdown.categoryConfidence < 10) {
    gaps.push('Unclear problem category');
  }

  return gaps;
}

/**
 * Main function: Calculate overall clarity score
 *
 * @param problem - User's problem description
 * @param categoryConfidence - Confidence from intent analysis (0-100)
 * @param answeredQuestions - Map of questionId -> answer
 * @param totalQuestionsAsked - Total number of questions asked so far
 * @returns ClarityScore with overall score, breakdown, and metadata
 */
export function calculateClarityScore(
  problem: string,
  categoryConfidence: number,
  answeredQuestions: Record<string, string>,
  totalQuestionsAsked: number
): ClarityScore {
  // Calculate each component
  const breakdown: ClarityBreakdown = {
    problemSpecificity: calculateProblemSpecificity(problem),
    categoryConfidence: calculateCategoryConfidence(categoryConfidence),
    questionsAnswered: calculateQuestionsAnswered(answeredQuestions, totalQuestionsAsked),
    contextCompleteness: calculateContextCompleteness(answeredQuestions),
  };

  // Calculate overall score (0-100)
  const overall =
    breakdown.problemSpecificity +
    breakdown.categoryConfidence +
    breakdown.questionsAnswered +
    breakdown.contextCompleteness;

  // Determine if should continue clarifying
  const shouldContinueClarifying = overall < 60;

  // Identify critical gaps
  const criticalGaps = identifyCriticalGaps(answeredQuestions, breakdown);

  return {
    overall,
    breakdown,
    shouldContinueClarifying,
    criticalGaps,
  };
}

/**
 * Simple heuristic fallback if clarity calculation fails
 */
export function calculateSimpleClarityScore(
  answeredCount: number,
  totalQuestions: number
): number {
  if (totalQuestions === 0) return 0;
  return Math.round((answeredCount / totalQuestions) * 100);
}
