/**
 * Vector similarity utilities for deterministic recommendation scoring
 */

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical direction
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (0 to 1 for normalized vectors)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimensions must match: ${a.length} vs ${b.length}`
    );
  }

  // Calculate dot product
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate normalized similarity score (0-100)
 * Converts cosine similarity to a percentage score
 *
 * @param similarity - Raw cosine similarity (-1 to 1)
 * @returns Normalized score (0 to 100)
 */
export function normalizeSimScore(similarity: number): number {
  // Convert from [-1, 1] to [0, 100]
  return Math.max(0, Math.min(100, (similarity + 1) * 50));
}

/**
 * Batch calculate similarities between a query vector and multiple target vectors
 *
 * @param queryVector - The user's query embedding
 * @param targets - Array of target vectors with IDs
 * @returns Map of ID to similarity score
 */
export function batchCosineSimilarity(
  queryVector: number[],
  targets: Array<{ id: string; embedding: number[] }>
): Map<string, number> {
  const results = new Map<string, number>();

  for (const target of targets) {
    try {
      const similarity = cosineSimilarity(queryVector, target.embedding);
      results.set(target.id, similarity);
    } catch (error) {
      console.error(`Error calculating similarity for ${target.id}:`, error);
      results.set(target.id, 0);
    }
  }

  return results;
}
