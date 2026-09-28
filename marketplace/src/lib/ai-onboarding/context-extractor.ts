// ============================================
// STAGE 1: CONTEXT INTELLIGENCE EXTRACTION
// Compresses large context (website, files) into structured facts
// Uses GPT-4o-mini for cost optimization
// ============================================

import { openai } from '@/lib/ai/openai';
import { ContextSummary, FileContent } from './types';

/**
 * Extract structured facts from website and file content
 * This is Stage 1 of the two-stage pipeline
 *
 * @param offeringName - Name of the offering
 * @param offeringSummary - Short summary provided by partner
 * @param websiteText - Cleaned text from scraped website
 * @param fileContents - Extracted text from uploaded files
 * @returns ContextSummary with structured facts
 */
export async function extractContext(
  offeringName: string,
  offeringSummary: string,
  websiteText?: string,
  fileContents?: FileContent[]
): Promise<ContextSummary> {
  // Build the compression prompt
  const prompt = buildContextExtractionPrompt(
    offeringName,
    offeringSummary,
    websiteText,
    fileContents
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low creativity, focus on extraction
      max_tokens: 2000, // Limit output size for cost control
    });

    const content = response.choices[0].message.content || '{}';
    const extracted = JSON.parse(content);
    const tokensUsed = response.usage?.total_tokens || 0;

    // Validate and normalize the response
    const contextSummary: ContextSummary = {
      product_description: extracted.product_description || '',
      target_industries: Array.isArray(extracted.target_industries)
        ? extracted.target_industries
        : [],
      use_cases: Array.isArray(extracted.use_cases) ? extracted.use_cases : [],
      key_features: Array.isArray(extracted.key_features)
        ? extracted.key_features
        : [],
      integrations: Array.isArray(extracted.integrations)
        ? extracted.integrations
        : [],
      security_features: Array.isArray(extracted.security_features)
        ? extracted.security_features
        : [],
      pricing_signals: Array.isArray(extracted.pricing_signals)
        ? extracted.pricing_signals
        : [],
      deployment_models: Array.isArray(extracted.deployment_models)
        ? extracted.deployment_models
        : [],
      implementation_notes: Array.isArray(extracted.implementation_notes)
        ? extracted.implementation_notes
        : [],
      tokensUsed,
    };

    console.log('[Context Extraction] Tokens used:', tokensUsed);
    return contextSummary;
  } catch (error: any) {
    console.error('[Context Extraction] Error:', error);

    // If JSON parsing fails, retry with explicit instructions
    if (error instanceof SyntaxError) {
      console.log('[Context Extraction] Retrying with explicit format...');
      return retryWithExplicitFormat(
        offeringName,
        offeringSummary,
        websiteText,
        fileContents
      );
    }

    // Return empty context on failure (graceful degradation)
    return createEmptyContext();
  }
}

/**
 * Build the context extraction prompt
 */
function buildContextExtractionPrompt(
  offeringName: string,
  offeringSummary: string,
  websiteText?: string,
  fileContents?: FileContent[]
): string {
  let prompt = `You are extracting structured facts from offering information for a B2B marketplace.

PROVIDER INPUTS:
- Offering Name: ${offeringName}
- Offering Summary: ${offeringSummary}
`;

  // Add scraped website content (limit to 8000 chars to control tokens)
  if (websiteText) {
    const truncatedWebsite = websiteText.slice(0, 8000);
    prompt += `\nSCRAPED WEBSITE CONTENT:\n${truncatedWebsite}\n`;
  }

  // Add uploaded file contents
  if (fileContents && fileContents.length > 0) {
    prompt += '\nUPLOADED FILES:\n';
    fileContents.forEach((file) => {
      const truncatedContent = file.content.slice(0, 3000); // Limit per file
      prompt += `\n--- ${file.filename} ---\n${truncatedContent}\n`;
    });
  }

  prompt += `
TASK: Extract and return JSON with these fields:
{
  "product_description": "2-3 sentence overview of what the offering does",
  "target_industries": ["Industry 1", "Industry 2"],
  "use_cases": ["Use case 1", "Use case 2"],
  "key_features": ["Feature 1", "Feature 2"],
  "integrations": ["Tool 1", "Tool 2"],
  "security_features": ["SOC2", "GDPR", "ISO 27001"],
  "pricing_signals": ["$50/month", "per-seat", "freemium"],
  "deployment_models": ["SaaS", "On-premise", "Hybrid"],
  "implementation_notes": ["Self-serve", "2-week setup", "Training included"]
}

RULES:
- Extract ONLY what is explicitly stated in the provided content
- If not found in the content, use empty array []
- Keep facts concise (no full sentences in arrays)
- No invention, no assumptions
- Focus on factual information, not marketing language
- For arrays, extract 3-5 items maximum per field
`;

  return prompt;
}

/**
 * Retry with more explicit formatting instructions
 */
async function retryWithExplicitFormat(
  offeringName: string,
  offeringSummary: string,
  websiteText?: string,
  fileContents?: FileContent[]
): Promise<ContextSummary> {
  const prompt = buildContextExtractionPrompt(
    offeringName,
    offeringSummary,
    websiteText,
    fileContents
  );

  const explicitPrompt =
    prompt +
    '\n\nIMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: explicitPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Even lower temperature
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content || '{}';
    const extracted = JSON.parse(content);
    const tokensUsed = response.usage?.total_tokens || 0;

    return {
      product_description: extracted.product_description || '',
      target_industries: Array.isArray(extracted.target_industries)
        ? extracted.target_industries
        : [],
      use_cases: Array.isArray(extracted.use_cases) ? extracted.use_cases : [],
      key_features: Array.isArray(extracted.key_features)
        ? extracted.key_features
        : [],
      integrations: Array.isArray(extracted.integrations)
        ? extracted.integrations
        : [],
      security_features: Array.isArray(extracted.security_features)
        ? extracted.security_features
        : [],
      pricing_signals: Array.isArray(extracted.pricing_signals)
        ? extracted.pricing_signals
        : [],
      deployment_models: Array.isArray(extracted.deployment_models)
        ? extracted.deployment_models
        : [],
      implementation_notes: Array.isArray(extracted.implementation_notes)
        ? extracted.implementation_notes
        : [],
      tokensUsed,
    };
  } catch (retryError) {
    console.error('[Context Extraction] Retry failed:', retryError);
    return createEmptyContext();
  }
}

/**
 * Create empty context for graceful degradation
 */
function createEmptyContext(): ContextSummary {
  return {
    product_description: '',
    target_industries: [],
    use_cases: [],
    key_features: [],
    integrations: [],
    security_features: [],
    pricing_signals: [],
    deployment_models: [],
    implementation_notes: [],
    tokensUsed: 0,
  };
}

/**
 * Check if context has meaningful data
 */
export function hasContextData(context: ContextSummary): boolean {
  return (
    context.product_description.length > 0 ||
    context.target_industries.length > 0 ||
    context.use_cases.length > 0 ||
    context.key_features.length > 0 ||
    context.integrations.length > 0
  );
}
