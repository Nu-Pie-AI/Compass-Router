// ============================================
// AI ONBOARDING TYPE DEFINITIONS
// ============================================

/**
 * Context stored in ChatConversation.context (JSON field)
 * Similar to AdvisorContext but for offering onboarding
 */
export interface AIOnboardingContext {
  phase:
    | 'initialized'
    | 'context-extracted'
    | 'intelligence-generated'
    | 'refining'
    | 'complete';

  // Partner inputs (5 required inputs)
  offeringName: string;
  offeringSummary: string; // 60-100 words
  websiteUrl?: string;
  allowWebBrowsing: 'yes' | 'no' | 'not-sure';
  partnerId?: string;
  isFirstTimeOnboarding?: boolean;
  uploadedFiles?: UploadedFile[];

  // Stage 1: Context extraction output
  contextSummary?: ContextSummary;
  websiteScraped?: boolean;
  filesProcessed?: number;

  // Stage 2: Intelligence generation output
  questionnaireAnswers?: string; // Full plain text response
  missingQuestions?: string[]; // Question IDs marked as Unknown

  // Clarification rounds tracking
  clarificationRounds?: ClarificationRound[];

  // Metadata
  confidenceScore?: number;
  estimatedCompleteness?: number; // 0-100%
  createdOfferingId?: string;
  tokensUsed?: {
    stage1: number;
    stage2: number;
    refinements: number;
    total: number;
  };
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  filename: string;
  url: string;
  type: 'pdf' | 'doc' | 'docx' | 'txt';
  size: number;
  extractedText?: string; // Text extracted from file
}

/**
 * Stage 1: Context extraction output (structured facts)
 */
export interface ContextSummary {
  product_description: string;
  target_industries: string[];
  use_cases: string[];
  key_features: string[];
  integrations: string[];
  security_features: string[];
  pricing_signals: string[];
  deployment_models: string[];
  implementation_notes: string[];
  tokensUsed: number;
}

/**
 * Clarification round tracking
 */
export interface ClarificationRound {
  round: number;
  questionsAsked: string[]; // Question IDs
  answersProvided: Record<string, string>; // questionId → answer
  timestamp: string;
  tokensUsed: number;
}

/**
 * Stage 1: Extract context request
 */
export interface ExtractContextRequest {
  sessionId: string;
  websiteUrl?: string;
  fileContents?: FileContent[];
}

/**
 * File content for Stage 1 processing
 */
export interface FileContent {
  filename: string;
  content: string; // Extracted text
  type: 'pdf' | 'doc' | 'docx' | 'txt';
}

/**
 * Stage 1: Extract context response
 */
export interface ExtractContextResponse {
  contextSummary: ContextSummary;
  tokensUsed: number;
  websiteScraped: boolean;
  filesProcessed: number;
}

/**
 * Stage 2: Generate intelligence request
 */
export interface GenerateIntelligenceRequest {
  sessionId: string;
}

/**
 * Stage 2: Generate intelligence response
 */
export interface GenerateIntelligenceResponse {
  answers: string; // Plain text with all 37 questions
  missingQuestions: string[]; // Question IDs marked Unknown
  clarificationNeeded: ClarificationQuestion[];
  confidenceScore: number;
  estimatedCompleteness: number; // 0-100%
}

/**
 * Clarification question for partner
 */
export interface ClarificationQuestion {
  questionId: string; // e.g., "Q3a", "Q16"
  question: string; // Short question text
  context: string; // Why we need this info
}

/**
 * Refine (clarification) request
 */
export interface RefineRequest {
  sessionId: string;
  clarifications: Record<string, string>; // questionId → answer
}

/**
 * Refine (clarification) response
 */
export interface RefineResponse {
  updatedAnswers: string; // Only updated questions
  stillMissing: string[]; // Question IDs still unknown
  readyToFinalize: boolean;
  confidenceScore: number;
}

/**
 * Finalize request
 */
export interface FinalizeRequest {
  sessionId: string;
  forceCreate?: boolean; // Create even if low confidence
}

/**
 * Finalize response
 */
export interface FinalizeResponse {
  offeringId: string;
  slug: string;
  status: 'published' | 'pending_review' | 'draft';
  confidenceScore: number;
  embeddingGenerated: boolean;
  enrichmentAnswersCount: number;
  redirectUrl: string;
  onboardingCompleted?: boolean;
}

/**
 * Parsed offering data from questionnaire
 */
export interface ParsedOfferingData {
  // Basic info
  title: string;
  shortDescription: string;
  description: string;
  offeringType: 'PRODUCT' | 'SERVICE' | 'IMPLEMENTATION' | 'TRAINING' | 'MANAGED_SERVICE';

  // Categorization
  primaryFunction: string;
  subCategory?: string;

  // Use cases & pain points
  useCases: string[];
  painPointsSolved: string[];

  // ICP (Ideal Customer Profile)
  icpTeamSize?: string;
  icpIndustry: string[];
  icpCompanyStage?: string;
  icpBudget?: string;

  // Integrations & tech
  integrations: string[];
  complianceFlags: string[];

  // Pricing
  pricingModel?: string;
  startingPrice?: number;
  hasFreeTrial: boolean;

  // Implementation
  implementationTime?: string;
  learningCurve?: string;

  // Location
  regions: string[];

  // Metadata
  confidenceScore: number;
  fieldConfidence?: Record<string, number>;
}

/**
 * Q&A pair for OfferingEnrichmentAnswer
 */
export interface EnrichmentQA {
  question: string; // Full question text
  answer: string; // Answer text
  questionId: string; // e.g., "Q1", "Q3a"
  confidence?: number; // Optional confidence for this specific answer
}

/**
 * Start session request
 */
export interface StartSessionRequest {
  offeringName: string;
  offeringSummary: string;
  websiteUrl?: string;
  allowWebBrowsing: 'yes' | 'no' | 'not-sure';
  uploadedFileUrls?: string[]; // URLs from separate upload endpoint
}

/**
 * Start session response
 */
export interface StartSessionResponse {
  sessionId: string;
  status: 'initialized';
  message: string;
  nextAction: 'scraping' | 'extracting' | 'generating';
}

/**
 * Error response
 */
export interface OnboardingErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  phase?: string;
}
