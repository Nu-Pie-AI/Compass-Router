// ============================================
// STAGE 2: OFFERING INTELLIGENCE GENERATION
// Generates comprehensive 37-question questionnaire answers
// Uses GPT-4o with master questionnaire prompt
// ============================================

import { openai } from '@/lib/ai/openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ContextSummary, ClarificationQuestion } from './types';

const FALLBACK_MASTER_PROMPT = [
  '# AI Marketplace Offering Intelligence Builder',
  '',
  'You are an AI assistant helping a provider generate a structured intelligence profile for exactly one offering listed in a B2B marketplace.',
  '',
  'CRITICAL RULES:',
  '- Prefer evidence from provider inputs, uploaded files, links, and scraped website content.',
  '- For non-sensitive operational questions, make a best-fit inference only when strongly supported.',
  '- Never invent risk-sensitive details such as certifications, integrations, pricing, hosting, security controls, legal terms, or exact commercial commitments.',
  '- If unknown, write Unknown.',
  '- Output plain text only.',
  '- Use the exact question numbers and sub-letters shown below.',
  '- After answering all questions, include a MISSING / NEEDS CONFIRMATION section listing any Unknown or uncertain items.',
  '- If nothing is missing, write MISSING / NEEDS CONFIRMATION: None',
  '- When complete, end with COMPLETE - ready to save.',
  '',
  'QUESTIONNAIRE',
  '',
  'Q1) Tools Ideal Fit',
  'Answer:',
  '---',
  'Q2) Top 5 Business Use Cases',
  'Answer:',
  '---',
  'Q3a) Target Industry',
  'Answer:',
  '---',
  'Q3b) Target Company Size (Employee)',
  'Answer:',
  '---',
  'Q3c) Target Company Size (Revenue)',
  'Answer:',
  '---',
  'Q3d) Growth Stage',
  'Answer:',
  '---',
  'Q3e) Operational Complexity Notes',
  'Answer:',
  '---',
  'Q3f) Target Region',
  'Answer:',
  '---',
  'Q4a) Primary Buyer Designation',
  'Answer:',
  '---',
  'Q4b) Primary Buyer Department',
  'Answer:',
  '---',
  'Q5) Ideal Situation for This Offering',
  'Answer:',
  '---',
  'Q6) Red Flag Situation',
  'Answer:',
  '---',
  'Q7) Typical Business Outcomes',
  'Answer:',
  '---',
  'Q8) Mini Case Studies',
  'Answer:',
  '---',
  'Q9) Time to Value',
  'Answer:',
  '---',
  'Q10) Customer Onboarding Effort',
  'Answer:',
  '---',
  'Q11) Key Modules / Features',
  'Answer:',
  '---',
  'Q12) End-to-End Functional Flow',
  'Answer:',
  '---',
  'Q13) Delivery Model',
  'Answer:',
  '---',
  'Q15) Implementation Model',
  'Answer:',
  '---',
  'Q16) Integrations',
  'Answer:',
  '---',
  'Q17) Integration Methods',
  'Answer:',
  '---',
  'Q18) Supported Data Formats',
  'Answer:',
  '---',
  'Q19) Data Sync Frequency',
  'Answer:',
  '---',
  'Q20) Multi-Entity Support',
  'Answer:',
  '---',
  'Q21) Authentication Methods',
  'Answer:',
  '---',
  'Q22) Hosting Platform',
  'Answer:',
  '---',
  'Q22b) Data Hosting Country',
  'Answer:',
  '---',
  'Q23) Role-Based Access Control',
  'Answer:',
  '---',
  'Q24) Security Certifications',
  'Answer:',
  '---',
  'Q25) Data Encryption',
  'Answer:',
  '---',
  'Q26) Audit Logs',
  'Answer:',
  '---',
  'Q27) Backup / Disaster Recovery',
  'Answer:',
  '---',
  'Q28) Pricing Model',
  'Answer:',
  '---',
  'Q29) Contract Terms',
  'Answer:',
  '---',
  'Q30) Minimum Contract Duration',
  'Answer:',
  '---',
  'Q31) Cancellation Policy',
  'Answer:',
  '---',
  'Q32) Typical Implementation Timeline',
  'Answer:',
  '---',
  'Q33) Implementation Steps',
  'Answer:',
  '---',
  'Q34) Training Availability',
  'Answer:',
  '---',
  'Q35) Support Model',
  'Answer:',
  '---',
  'Q36) Escalation Path',
  'Answer:',
  '---',
  'Q37) AI Qualification Questions',
  'Answer:',
  '---',
  'MISSING / NEEDS CONFIRMATION:',
  'List every unanswered or uncertain item. If none remain, write None.',
].join('\n');

const MAX_CLARIFICATION_QUESTIONS = 6;
const CLARIFICATION_PRIORITY: Record<string, number> = {
  Q3a: 1,
  Q3b: 2,
  Q3c: 3,
  Q3d: 4,
  Q3e: 5,
  Q3f: 6,
  Q5: 7,
  Q6: 8,
  Q8: 9,
  Q9: 10,
  Q10: 11,
  Q11: 12,
  Q12: 13,
  Q13: 14,
  Q15: 15,
  Q16: 16,
  Q28: 17,
  Q32: 18,
  Q33: 19,
  Q34: 20,
  Q35: 21,
  Q37: 22,
};

const QUESTION_LABELS: Record<string, string> = {
  Q1: 'Tools Ideal Fit',
  Q2: 'Top 5 Business Use Cases',
  Q3a: 'Target Industry',
  Q3b: 'Target Company Size (Employee)',
  Q3c: 'Target Company Size (Revenue)',
  Q3d: 'Growth Stage',
  Q3e: 'Operational Complexity Notes',
  Q3f: 'Target Region',
  Q4a: 'Primary Buyer Designation',
  Q4b: 'Primary Buyer Department',
  Q5: 'Ideal Situation for This Offering',
  Q6: 'Red Flag Situation',
  Q7: 'Typical Business Outcomes',
  Q8: 'Mini Case Studies',
  Q9: 'Time to Value',
  Q10: 'Customer Onboarding Effort',
  Q11: 'Key Modules / Features',
  Q12: 'End-to-End Functional Flow',
  Q13: 'Delivery Model',
  Q15: 'Implementation Model',
  Q16: 'Integrations',
  Q17: 'Integration Methods',
  Q18: 'Supported Data Formats',
  Q19: 'Data Sync Frequency',
  Q20: 'Multi-Entity Support',
  Q21: 'Authentication Methods',
  Q22: 'Hosting Platform',
  Q22b: 'Data Hosting Country',
  Q23: 'Role-Based Access Control',
  Q24: 'Security Certifications',
  Q25: 'Data Encryption',
  Q26: 'Audit Logs',
  Q27: 'Backup / Disaster Recovery',
  Q28: 'Pricing Model',
  Q29: 'Contract Terms',
  Q30: 'Minimum Contract Duration',
  Q31: 'Cancellation Policy',
  Q32: 'Typical Implementation Timeline',
  Q33: 'Implementation Steps',
  Q34: 'Training Availability',
  Q35: 'Support Model',
  Q36: 'Escalation Path',
  Q37: 'AI Qualification Questions',
};

/**
 * Generate questionnaire answers using master prompt
 * This is Stage 2 of the two-stage pipeline
 *
 * @param offeringName - Name of the offering
 * @param offeringSummary - Short summary provided by partner
 * @param contextSummary - Structured facts from Stage 1
 * @param websiteUrl - Optional website URL
 * @param allowWebBrowsing - Whether browsing is allowed
 * @param uploadedFiles - List of uploaded files
 * @returns Plain text answers and missing questions
 */
export async function generateIntelligence(
  offeringName: string,
  offeringSummary: string,
  contextSummary?: ContextSummary,
  websiteUrl?: string,
  allowWebBrowsing?: 'yes' | 'no' | 'not-sure',
  uploadedFiles?: Array<{ filename: string; url: string }>
): Promise<{
  answers: string;
  missingQuestions: string[];
  clarificationNeeded: ClarificationQuestion[];
}> {
  // Load master questionnaire prompt
  const masterPrompt = loadMasterQuestionnairePrompt();

  // Build the full prompt with context
  const fullPrompt = buildIntelligencePrompt(
    masterPrompt,
    offeringName,
    offeringSummary,
    contextSummary,
    websiteUrl,
    allowWebBrowsing,
    uploadedFiles
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.3, // Low creativity, focus on accuracy
      max_tokens: 4000, // Allow for comprehensive answers
    });

    const answersText = response.choices[0].message.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    console.log('[Intelligence Generation] Tokens used:', tokensUsed);

    // Extract missing questions from the response
    const { missingQuestions, clarificationNeeded } =
      extractMissingQuestions(answersText);

    return {
      answers: answersText,
      missingQuestions,
      clarificationNeeded,
    };
  } catch (error: unknown) {
    console.error('[Intelligence Generation] Error:', error);

    // Retry with reduced temperature on failure
    if (isRetryableOpenAIError(error)) {
      console.log('[Intelligence Generation] Retrying with reduced settings...');
      return retryIntelligenceGeneration(
        masterPrompt,
        offeringName,
        offeringSummary,
        contextSummary,
        websiteUrl,
        allowWebBrowsing,
        uploadedFiles
      );
    }

    throw error;
  }
}

/**
 * Update only missing questions with clarifications
 * This is used in the clarification loop for incremental updates
 *
 * @param existingAnswers - Current questionnaire answers
 * @param clarifications - Partner-provided clarifications
 * @param missingQuestionIds - Question IDs to update
 * @returns Updated answers and remaining missing questions
 */
export async function refineAnswers(
  existingAnswers: string,
  clarifications: Record<string, string>,
  missingQuestionIds: string[]
): Promise<{
  updatedAnswers: string;
  stillMissing: string[];
  clarificationNeeded: ClarificationQuestion[];
}> {
  // Build lightweight update prompt
  const updatePrompt = buildUpdatePrompt(
    existingAnswers,
    clarifications,
    missingQuestionIds
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use cheap model for updates
      messages: [{ role: 'user', content: updatePrompt }],
      temperature: 0.2, // Very low creativity for updates
      max_tokens: 1000, // Small response
    });

    const partialUpdate = response.choices[0].message.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    console.log('[Refinement] Tokens used:', tokensUsed);

    // Merge the partial update with existing answers
    const mergedAnswers = mergeAnswers(existingAnswers, partialUpdate);

    // Check which questions are still missing and generate their details
    const { missingQuestions, clarificationNeeded } = extractMissingQuestions(mergedAnswers);

    return {
      updatedAnswers: mergedAnswers,
      stillMissing: missingQuestions,
      clarificationNeeded,
    };
  } catch (error: unknown) {
    console.error('[Refinement] Error:', error);
    // On error, return existing answers unchanged
    return {
      updatedAnswers: existingAnswers,
      stillMissing: missingQuestionIds,
      clarificationNeeded: [],
    };
  }
}

/**
 * Load master questionnaire prompt from file
 */
function loadMasterQuestionnairePrompt(): string {
  try {
    const promptPath = join(
      process.cwd(),
      'src',
      'lib',
      'prompts',
      'offering-intelligence-prompt.md'
    );
    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('[Intelligence Generator] Failed to load master prompt:', error);
    console.warn('[Intelligence Generator] Falling back to bundled prompt.');
    return FALLBACK_MASTER_PROMPT;
  }
}

/**
 * Build the full intelligence generation prompt
 */
function buildIntelligencePrompt(
  masterPrompt: string,
  offeringName: string,
  offeringSummary: string,
  contextSummary?: ContextSummary,
  websiteUrl?: string,
  allowWebBrowsing?: 'yes' | 'no' | 'not-sure',
  uploadedFiles?: Array<{ filename: string; url: string }>
): string {
  // Build the provider inputs section
  const providerInputsSection = `
PROVIDER INPUTS:

A) Offering Name (Required):
${offeringName}

B) Offering Summary (Required):
${offeringSummary}

C) Links (Optional):
${websiteUrl || 'Not provided'}

D) Uploaded Materials (Optional):
${uploadedFiles && uploadedFiles.length > 0 ? uploadedFiles.map((f) => `- ${f.filename}`).join('\n') : 'None'}

E) Web Browsing Availability:
${allowWebBrowsing || 'not-sure'}
`;

  // Add context intelligence if available (from Stage 1)
  let contextSection = '';
  if (contextSummary) {
    contextSection = `
CONTEXT INTELLIGENCE (Extracted from Website/Files):

Product Description:
${contextSummary.product_description || 'Not available'}

Target Industries:
${contextSummary.target_industries.length > 0 ? contextSummary.target_industries.join(', ') : 'Not specified'}

Use Cases:
${contextSummary.use_cases.length > 0 ? contextSummary.use_cases.map((uc, i) => `${i + 1}. ${uc}`).join('\n') : 'Not specified'}

Key Features:
${contextSummary.key_features.length > 0 ? contextSummary.key_features.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'Not specified'}

Integrations:
${contextSummary.integrations.length > 0 ? contextSummary.integrations.join(', ') : 'Not specified'}

Security Features:
${contextSummary.security_features.length > 0 ? contextSummary.security_features.join(', ') : 'Not specified'}

Pricing Signals:
${contextSummary.pricing_signals.length > 0 ? contextSummary.pricing_signals.join(', ') : 'Not specified'}

Deployment Models:
${contextSummary.deployment_models.length > 0 ? contextSummary.deployment_models.join(', ') : 'Not specified'}

Implementation Notes:
${contextSummary.implementation_notes.length > 0 ? contextSummary.implementation_notes.join(', ') : 'Not specified'}
`;
  }

  // Combine master prompt with inputs
  const fullPrompt = `${masterPrompt}

---

${providerInputsSection}

${contextSection}

INFERENCE GUIDANCE:

- Prefer explicit evidence from the provider summary and extracted context.
- For non-sensitive operational questions, infer the most likely best-fit answer when the summary strongly implies it.
- It is better to provide a concise, reasonable SMB-marketplace answer than to mark routine operational questions as Unknown.
- Keep Unknown for security, hosting, legal, contract, compliance, and exact commercial details unless directly evidenced.
- Always answer Q37 with high-quality discovery questions based on the offering, ICP, and use cases. Do not mark Q37 as Unknown.

Now answer all 37 questions in the questionnaire below. Follow the format exactly as specified in the questionnaire section above.
`;

  return fullPrompt;
}

/**
 * Build update prompt for clarification loop
 */
function buildUpdatePrompt(
  existingAnswers: string,
  clarifications: Record<string, string>,
  missingQuestionIds: string[]
): string {
  const clarificationText = Object.entries(clarifications)
    .map(([questionId, answer]) => `${questionId}: ${answer}`)
    .join('\n');

  return `ORIGINAL QUESTIONNAIRE ANSWERS:
${existingAnswers}

NEW INFORMATION PROVIDED BY PARTNER:
${clarificationText}

TASK: Update ONLY the following questions with the new information: ${missingQuestionIds.join(', ')}

Return the updated answers for these questions in the same format as the original questionnaire.
Keep all other answers unchanged.
Preserve detailed existing answers whenever they are already useful.
Do not replace a real answer with shorthand such as "see above", "same as above", "n/a", or placeholders.
If a question still cannot be answered, leave it as Unknown.

IMPORTANT: If a question is now answerable, remove it from the MISSING / NEEDS CONFIRMATION section.
`;
}

/**
 * Extract missing questions from the response
 */
function extractMissingQuestions(answersText: string): {
  missingQuestions: string[];
  clarificationNeeded: ClarificationQuestion[];
} {
  const missingQuestions: string[] = [];
  const clarificationNeeded: ClarificationQuestion[] = [];

  // Look for the MISSING / NEEDS CONFIRMATION section
  const missingMatch = answersText.match(
    /MISSING \/ NEEDS CONFIRMATION[:\s]+([\s\S]*?)(?=\n\n|COMPLETE|$)/i
  );

  if (missingMatch) {
    const missingSection = missingMatch[1];

    // Check if it says "None"
    if (missingSection.trim().toLowerCase() === 'none') {
      return { missingQuestions: [], clarificationNeeded: [] };
    }

    // Extract question IDs (Q1, Q3a, Q16, etc.)
    const questionIdPattern = /Q\d+[a-z]?/gi;
    const matches = missingSection.match(questionIdPattern);

    if (matches) {
      const prioritizedMatches = Array.from(new Set(matches))
        .sort(compareClarificationPriority)
        .slice(0, MAX_CLARIFICATION_QUESTIONS);

      missingQuestions.push(...prioritizedMatches);

      // Create clarification questions
      prioritizedMatches.forEach((questionId) => {
        const question = generateClarificationQuestion(questionId, answersText);
        if (question) {
          clarificationNeeded.push(question);
        }
      });
    }
  }

  return { missingQuestions, clarificationNeeded };
}

/**
 * Generate a clarification question for a missing answer
 */
function generateClarificationQuestion(
  questionId: string,
  answersText: string
): ClarificationQuestion | null {
  const questionText = extractQuestionLabel(answersText, questionId);

  if (questionText) {
    return {
      questionId,
      question: questionText,
      context: `This information will help us better understand your offering.`,
    };
  }

  const knownLabel = QUESTION_LABELS[questionId];
  if (knownLabel) {
    return {
      questionId,
      question: knownLabel,
      context: `This information will help us better understand your offering.`,
    };
  }

  return {
    questionId,
    question: `Please provide details for ${questionId}.`,
    context: `This information will help us better understand your offering.`,
  };
}

/**
 * Merge partial update with existing answers
 * Improved to handle multi-line answer format
 */
function mergeAnswers(existingAnswers: string, partialUpdate: string): string {
  // Parse both texts into question-answer maps
  const existingMap = parseAnswersToMap(existingAnswers);
  const updateMap = parseAnswersToMap(partialUpdate);

  // Merge updates into existing, but protect richer existing answers from
  // being overwritten by low-information responses like "see above".
  const mergedMap = { ...existingMap };

  for (const [questionId, updatedAnswer] of Object.entries(updateMap)) {
    const existingAnswer = existingMap[questionId];

    if (
      existingAnswer &&
      !isWeakAnswer(existingAnswer) &&
      isWeakAnswer(updatedAnswer)
    ) {
      continue;
    }

    mergedMap[questionId] = updatedAnswer;
  }

  // Reconstruct the full text
  let result = '';
  const questionIds = Array.from(
    new Set([...Object.keys(existingMap), ...Object.keys(updateMap)])
  ).sort(compareQuestionIds);

  questionIds.forEach((qId) => {
    const answer = mergedMap[qId];
    if (answer) {
      // Try to extract full question text from original
      const questionText = extractQuestionLabel(existingAnswers, qId) || '';

      result += `${qId}) ${questionText}\n\nAnswer: ${answer}\n\n---\n\n`;
    }
  });

  // Merge the MISSING section logic
  const updateMissingMatch = partialUpdate.match(/MISSING \/ NEEDS CONFIRMATION[:\s]+([\s\S]*?)(?=\n\n|COMPLETE|$)/i);
  const originalMissingMatch = existingAnswers.match(/MISSING \/ NEEDS CONFIRMATION[:\s]+([\s\S]*?)(?=\n\n|COMPLETE|$)/i);

  if (updateMissingMatch) {
    result += `MISSING / NEEDS CONFIRMATION:\n${updateMissingMatch[1]}\n`;
  } else if (originalMissingMatch) {
    // If update didn't provide a missing section, we filter the original one
    // to remove questions we just answered in this matching pass
    const answeredIds = Object.keys(mergedMap);
    let filteredSection = originalMissingMatch[1];
    
    answeredIds.forEach(id => {
      // Remove patterns like "- Q1", "Q1: Description", etc.
      const idRegex = new RegExp(`^\\s*[-\\s]*${id}\\b[^\\n]*$`, 'mgi');
      filteredSection = filteredSection.replace(idRegex, '');
    });

    const finalMissing = filteredSection.trim();
    if (finalMissing && finalMissing.toLowerCase() !== 'none') {
      result += `MISSING / NEEDS CONFIRMATION:\n${finalMissing}\n`;
    } else {
      result += `MISSING / NEEDS CONFIRMATION:\nNone\n`;
    }
  }

  return result;
}

/**
 * Parse questionnaire answers into a map
 */
function parseAnswersToMap(answersText: string): Record<string, string> {
  const map: Record<string, string> = {};

  const blocks = extractQuestionBlocks(answersText);

  for (const block of blocks) {
    const answerMatch = block.body.match(/Answer:\s*([\s\S]*?)(?=\n\s*---|$)/i);
    const answer = answerMatch?.[1]?.trim();

    if (answer && answer !== 'Unknown') {
      map[block.questionId] = answer;
    }
  }

  return map;
}

function extractQuestionLabel(
  answersText: string,
  questionId: string
): string | null {
  const block = extractQuestionBlocks(answersText).find(
    (entry) => entry.questionId.toLowerCase() === questionId.toLowerCase()
  );

  if (block?.label) {
    return block.label;
  }

  return null;
}

function extractQuestionBlocks(answersText: string): Array<{
  questionId: string;
  label: string;
  body: string;
}> {
  const blocks: Array<{ questionId: string; label: string; body: string }> = [];
  const pattern =
    /(?:^|\n)(?:#+\s*)?(Q\d+[a-z]?)(?:\)|\b)\s*([^\n]*)\n([\s\S]*?)(?=\n(?:#+\s*)?Q\d+[a-z]?(?:\)|\b)|\nMISSING|\nCOMPLETE|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(answersText)) !== null) {
    blocks.push({
      questionId: match[1],
      label: match[2].trim(),
      body: match[3],
    });
  }

  return blocks;
}

function isWeakAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return /^(unknown|n\/a|na|none|not provided|see above|same as above|as above|tbd)\b/.test(
    normalized
  );
}

function compareQuestionIds(left: string, right: string): number {
  const leftMatch = left.match(/^Q(\d+)([a-z]?)$/i);
  const rightMatch = right.match(/^Q(\d+)([a-z]?)$/i);

  if (!leftMatch || !rightMatch) {
    return left.localeCompare(right);
  }

  const leftNumber = Number(leftMatch[1]);
  const rightNumber = Number(rightMatch[1]);

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return leftMatch[2].localeCompare(rightMatch[2]);
}

function compareClarificationPriority(left: string, right: string): number {
  const leftPriority = CLARIFICATION_PRIORITY[left] ?? 999;
  const rightPriority = CLARIFICATION_PRIORITY[right] ?? 999;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return compareQuestionIds(left, right);
}

function isRetryableOpenAIError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  return code === 'timeout' || code === 'rate_limit_exceeded';
}

/**
 * Retry intelligence generation with reduced settings
 */
async function retryIntelligenceGeneration(
  masterPrompt: string,
  offeringName: string,
  offeringSummary: string,
  contextSummary?: ContextSummary,
  websiteUrl?: string,
  allowWebBrowsing?: 'yes' | 'no' | 'not-sure',
  uploadedFiles?: Array<{ filename: string; url: string }>
): Promise<{
  answers: string;
  missingQuestions: string[];
  clarificationNeeded: ClarificationQuestion[];
}> {
  const fullPrompt = buildIntelligencePrompt(
    masterPrompt,
    offeringName,
    offeringSummary,
    contextSummary,
    websiteUrl,
    allowWebBrowsing,
    uploadedFiles
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.2, // Lower temperature
      max_tokens: 3500, // Reduced tokens
    });

    const answersText = response.choices[0].message.content || '';
    const { missingQuestions, clarificationNeeded } =
      extractMissingQuestions(answersText);

    return {
      answers: answersText,
      missingQuestions,
      clarificationNeeded,
    };
  } catch (retryError) {
    console.error('[Intelligence Generation] Retry failed:', retryError);
    throw retryError;
  }
}
