// ============================================
// EMBEDDING GENERATOR
// Auto-generates vector embeddings for offerings
// Uses text-embedding-3-small (1536 dimensions)
// ============================================

import { openai } from '@/lib/ai/openai';
import { ParsedOfferingData } from './types';

/**
 * Generate embedding vector for an offering
 * Concatenates key fields and generates 1536-dimension vector
 *
 * @param offeringData - Parsed offering data
 * @returns Embedding vector (1536 dimensions)
 */
export async function generateOfferingEmbedding(
  offeringData: ParsedOfferingData
): Promise<number[]> {
  // Build embedding text from key fields
  const embeddingText = buildEmbeddingText(offeringData);

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    });

    const embedding = response.data[0].embedding;

    // Validate embedding dimensions
    if (embedding.length !== 1536) {
      console.warn(
        `[Embedding Generator] Unexpected embedding dimensions: ${embedding.length}`
      );
    }

    console.log('[Embedding Generator] Successfully generated embedding');
    return embedding;
  } catch (error: any) {
    console.error('[Embedding Generator] Error:', error);

    // Retry once on failure
    if (error.code === 'timeout' || error.code === 'rate_limit_exceeded') {
      console.log('[Embedding Generator] Retrying...');
      return retryEmbeddingGeneration(embeddingText);
    }

    throw error;
  }
}

/**
 * Build embedding text from offering data
 * Concatenates most semantically important fields
 */
function buildEmbeddingText(offeringData: ParsedOfferingData): string {
  const parts: string[] = [];

  // Title (most important)
  if (offeringData.title) {
    parts.push(offeringData.title);
  }

  // Short description
  if (offeringData.shortDescription) {
    parts.push(offeringData.shortDescription);
  }

  // Primary function/category
  if (offeringData.primaryFunction) {
    parts.push(offeringData.primaryFunction);
  }

  // Use cases (top semantic signal)
  if (offeringData.useCases && offeringData.useCases.length > 0) {
    parts.push(...offeringData.useCases);
  }

  // Pain points solved
  if (offeringData.painPointsSolved && offeringData.painPointsSolved.length > 0) {
    parts.push(...offeringData.painPointsSolved);
  }

  // Key integrations (helps with matching)
  if (offeringData.integrations && offeringData.integrations.length > 0) {
    const topIntegrations = offeringData.integrations.slice(0, 5);
    parts.push(`Integrates with: ${topIntegrations.join(', ')}`);
  }

  // ICP industry (helps with targeting)
  if (offeringData.icpIndustry && offeringData.icpIndustry.length > 0) {
    parts.push(`For industries: ${offeringData.icpIndustry.join(', ')}`);
  }

  // Join all parts with spaces
  const embeddingText = parts.filter(Boolean).join(' ');

  // Truncate if too long (embedding models have token limits)
  const maxLength = 8000; // Safe limit for text-embedding-3-small
  if (embeddingText.length > maxLength) {
    return embeddingText.slice(0, maxLength);
  }

  return embeddingText;
}

/**
 * Retry embedding generation with exponential backoff
 */
async function retryEmbeddingGeneration(
  embeddingText: string
): Promise<number[]> {
  // Wait 2 seconds before retry
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    });

    return response.data[0].embedding;
  } catch (retryError) {
    console.error('[Embedding Generator] Retry failed:', retryError);
    throw retryError;
  }
}

/**
 * Generate embedding from raw text (for testing or custom use)
 *
 * @param text - Text to embed
 * @returns Embedding vector
 */
export async function generateEmbeddingFromText(
  text: string
): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[Embedding Generator] Error generating from text:', error);
    throw error;
  }
}

/**
 * Validate embedding vector
 *
 * @param embedding - Embedding vector to validate
 * @returns True if valid
 */
export function validateEmbedding(embedding: number[]): boolean {
  // Check dimensions
  if (embedding.length !== 1536) {
    console.error(
      `[Embedding Generator] Invalid dimensions: ${embedding.length}`
    );
    return false;
  }

  // Check for NaN or Infinity
  const hasInvalidValues = embedding.some(
    (value) => isNaN(value) || !isFinite(value)
  );

  if (hasInvalidValues) {
    console.error('[Embedding Generator] Contains NaN or Infinity');
    return false;
  }

  return true;
}
