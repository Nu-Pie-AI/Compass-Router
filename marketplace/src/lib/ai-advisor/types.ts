// ============================================
// AI ADVISOR TYPE DEFINITIONS
// ============================================

/**
 * Clarity score breakdown (0-100 total)
 */
export interface ClarityBreakdown {
  problemSpecificity: number; // 0-20
  categoryConfidence: number; // 0-20
  questionsAnswered: number; // 0-40
  contextCompleteness: number; // 0-20
}

/**
 * Clarity score result
 */
export interface ClarityScore {
  overall: number; // 0-100
  breakdown: ClarityBreakdown;
  shouldContinueClarifying: boolean; // true if < 60%
  criticalGaps: string[]; // ["Need budget info", "Unclear about team size"]
}

/**
 * AI-generated solution structure
 */
export interface AISolution {
  summary: string;
  actionableSteps: string[];
  toolTypesNeeded: string[];
  estimatedImplementationTime: string;
  budgetConsiderations: string;
}

export interface AdvisorKnownFacts {
  category?: string;
  teamSize?: string;
  budget?: string;
  urgency?: string;
  companyStage?: string;
  useCases?: string[];
  integrations?: string[];
  rejectedProducts?: string[];
  constraints?: string[];
}

export type AdvisorMode =
  | 'intake'
  | 'clarifying'
  | 'solution'
  | 'awaiting_recommendation_consent'
  | 'recommending_internal'
  | 'recommending_external'
  | 'comparing'
  | 'advising'
  | 'exhausted';

export type TurnIntent =
  | 'clarify_intent'
  | 'answer_question_from_context'
  | 'compare_existing_recommendations'
  | 'show_more_recommendations'
  | 'recommend_for_current_need'
  | 'recommend_for_new_requirement'
  | 'general_advice_follow_up';

export type TurnReplyStrategy =
  | 'clarify'
  | 'answer'
  | 'compare'
  | 'recommend'
  | 'paginate';

export type RecommendationSource = 'internal' | 'external';

export interface TurnInterpretation {
  turnIntent: TurnIntent;
  confidence: number;
  reasoning: string;
  needsClarification: boolean;
  isNewRequirement: boolean;
  referencesShownRecommendations: boolean;
  replyStrategy: TurnReplyStrategy;
  requirementSummary: string | null;
  targetCategory: string | null;
  rejectedProducts: string[];
  constraints: string[];
  shouldGenerateRecommendations: boolean;
  shouldReplayExistingRecommendations: boolean;
  shouldContinueAdvisoryDiscussion: boolean;
}

/**
 * Context stored in ChatConversation.context (JSON field)
 */
export interface AdvisorContext {
  phase: 'intent' | 'clarifying' | 'clarifying-iterative' | 'solution-generated' | 'complete';
  mode?: AdvisorMode;
  problem: string;
  detectedCategory: string;
  detectedIntent: string;
  categoryConfidence: number; // 0-100, from intent analysis
  questions: AdvisorQuestion[];
  answers?: Record<string, string>; // keyed by question id
  knownFacts?: AdvisorKnownFacts;
  facts?: AdvisorKnownFacts;
  clarityScore?: ClarityScore; // current clarity score
  questionsAsked: number; // iteration count
  aiSolution?: AISolution; // generated solution from Phase 4
  currentNeedSummary?: string | null;
  recommendationSource?: RecommendationSource | null;
  recommendationIds?: string[]; // product IDs of final top 3
  shownRecommendationIds?: string[]; // all internal recommendation IDs shown in this conversation
  shownInternalIds?: string[];
  externalRecommendationIds?: string[];
  availableExternalIds?: string[];
  shownExternalIds?: string[];
  lastRecommendationType?: RecommendationSource;
  recommendationExhausted?: boolean;
  lastAssistantIntent?: TurnIntent | null;
}

/**
 * Question structure for clarification step
 */
export interface AdvisorQuestion {
  id: string;
  text: string;
  options: string[];
  allowMultiple?: boolean;
}

/**
 * Result from intent analysis API
 */
export interface IntentResult {
  conversationId: string;
  detectedCategory: string;
  detectedIntent: string;
  questions: AdvisorQuestion[];
}

/**
 * Offering with score and reasoning
 */
export interface ScoredOffering {
  offering: AdvisorOfferingData;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string;
}

/**
 * @deprecated Use ScoredOffering instead
 * Product with score and reasoning (legacy)
 */
export interface ScoredProduct {
  product: AdvisorProductData;
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string;
}

/**
 * Breakdown of scoring components
 */
export interface ScoreBreakdown {
  categoryMatch: number; // 0-30
  teamSizeMatch: number; // 0-15
  budgetMatch: number; // 0-15
  useCaseMatch: number; // 0-20
  targetCustomerMatch: number; // 0-10
  ratingScore: number; // 0-10
}

/**
 * Offering data needed for AI matching
 */
export interface AdvisorOfferingData {
  id: string;
  slug: string;
  title: string; // was: name
  logo: string | null;
  shortDescription: string | null;
  averageRating: number;
  reviewCount: number;
  pricingModel: string | null;
  startingPrice: number | null;
  offeringType: string; // NEW: PRODUCT | SERVICE | etc.
  icpTeamSize: string | null; // was: companySize
  icpIndustry: string[]; // NEW
  icpBudget: string | null; // NEW
  hasFreeTrial: boolean;
  primaryFunction: string | null;
  useCases: string[]; // NEW: array of use case strings
  painPointsSolved: string[]; // NEW: array of pain points
  embedding: number[] | null; // Vector embedding for semantic similarity
  categories: { slug: string; name: string }[];
  integrations: string[];
  features: { name: string; description: string }[];
  enrichmentAnswers: { // was: onboardingAnswers
    question: string; // was: questionNumber (int)
    answer: string; // was: answerText/answerJson
  }[];
}

/**
 * @deprecated Use AdvisorOfferingData instead
 * Product data needed for AI matching (legacy)
 */
export interface AdvisorProductData {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  shortDescription: string | null;
  averageRating: number;
  reviewCount: number;
  pricingModel: string | null;
  startingPrice: number | null;
  companySize: string | null;
  hasFreeTrial: boolean;
  listingType: string;
  primaryFunction: string | null;
  smbFriendly: boolean;
  categories: { slug: string; name: string }[];
  features: { name: string }[];
  onboardingAnswers: {
    questionNumber: number;
    answerText: string | null;
    answerJson: unknown;
  }[];
}

/**
 * User context from clarification questions
 */
export interface UserContext {
  problemDescription: string;
  detectedCategory: string;
  detectedIntent: string;
  teamSize?: string;
  budget?: string;
  urgency?: string;
  companyStage?: string;
  useCases?: string[];
  integrations?: string[];
  rejectedProducts?: string[];
  constraints?: string[];
}

/**
 * Client-side state machine phases
 */
export type AdvisorPhase =
  | 'idle'
  | 'analyzing'
  | 'clarifying'
  | 'clarifying-iterative' // iterative Q&A until 60% clarity
  | 'generating-solution'  // creating AI solution
  | 'solution-display'     // showing AI solution
  | 'recommending'
  | 'results'
  | 'error';

/**
 * Client-side application state
 */
export interface AdvisorState {
  phase: AdvisorPhase;
  conversationId: string | null;
  problem: string;
  intent: IntentResult | null;
  answers: Record<string, string>;
  recommendations: ScoredProduct[] | null;
  error: string | null;
}

/**
 * External recommendation when no internal offerings match
 */
export interface ExternalRecommendation {
  id: string;
  productName: string;
  productUrl: string | null;
  category: string;
  shortDescription: string;
  reasoning: string;
  confidence: number;
  clickCount: number;
  createdAt: Date;
}

/**
 * Prisma select object for advisor offerings
 */
export const advisorOfferingSelect = {
  id: true,
  slug: true,
  title: true, // was: name
  shortDescription: true,
  logo: true,
  averageRating: true,
  reviewCount: true,
  pricingModel: true,
  startingPrice: true,
  offeringType: true, // NEW
  icpTeamSize: true, // was: companySize
  icpIndustry: true, // NEW
  icpBudget: true, // NEW
  hasFreeTrial: true,
  primaryFunction: true,
  useCases: true, // NEW
  painPointsSolved: true, // NEW
  embedding: true, // For semantic similarity scoring
  categories: {
    select: { slug: true, name: true },
  },
  integrations: true,
  features: {
    select: { name: true, description: true },
    take: 5,
    orderBy: { order: 'asc' as const },
  },
  enrichmentAnswers: { // was: onboardingAnswers
    select: {
      question: true, // String field
      answer: true, // String field
    },
  },
};

/**
 * @deprecated Use advisorOfferingSelect instead
 * Prisma select object for advisor products (legacy)
 */
export const advisorProductSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  logo: true,
  averageRating: true,
  reviewCount: true,
  pricingModel: true,
  startingPrice: true,
  companySize: true,
  hasFreeTrial: true,
  listingType: true,
  primaryFunction: true,
  smbFriendly: true,
  categories: {
    select: { slug: true, name: true },
  },
  features: {
    select: { name: true },
    take: 3,
    orderBy: { order: 'asc' as const },
  },
  onboardingAnswers: {
    select: {
      question: {
        select: {
          questionNumber: true,
        },
      },
      answerText: true,
      answerJson: true,
    },
  },
};
