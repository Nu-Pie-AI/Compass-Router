import { AdvisorContext, RecommendationSource } from '@/lib/ai-advisor/types';

export const BATCH_SIZE = 3;
export const INTERNAL_THRESHOLD = 60;
export const MIN_QUALITY_SCORE = 50;
export const NO_MORE_RECOMMENDATIONS_MESSAGE =
  'No more recommendations available for your current requirements.';

type RecommendationState = {
  shownInternalIds: string[];
  shownExternalIds: string[];
  externalRecommendationIds: string[];
  lastRecommendationType?: RecommendationSource;
  recommendationExhausted: boolean;
};

export function mergeUniqueIds(
  existing: string[] = [],
  incoming: string[] = []
): string[] {
  return Array.from(new Set([...existing, ...incoming]));
}

export function normalizeRecommendationState(
  context: AdvisorContext
): RecommendationState {
  const shownInternalIds =
    context.shownInternalIds || context.shownRecommendationIds || [];
  const shownExternalIds = context.shownExternalIds || [];
  const externalRecommendationIds = context.externalRecommendationIds || [];
  const lastRecommendationType =
    context.lastRecommendationType ||
    (shownExternalIds.length > 0
      ? 'external'
      : shownInternalIds.length > 0
        ? 'internal'
        : undefined);

  return {
    shownInternalIds,
    shownExternalIds,
    externalRecommendationIds,
    lastRecommendationType,
    recommendationExhausted: Boolean(context.recommendationExhausted),
  };
}

export function resetRecommendationState(
  context: AdvisorContext
): AdvisorContext {
  return {
    ...context,
    recommendationIds: [],
    shownRecommendationIds: [],
    shownInternalIds: [],
    externalRecommendationIds: [],
    shownExternalIds: [],
    lastRecommendationType: undefined,
    recommendationExhausted: false,
  };
}

export function filterNewRecommendations<T>(
  results: T[],
  shownIds: string[],
  getId: (item: T) => string
): T[] {
  return results.filter((result) => !shownIds.includes(getId(result)));
}

export function getNextBatch<T>(
  results: T[],
  shownIds: string[],
  getId: (item: T) => string,
  batchSize = BATCH_SIZE
): T[] {
  return filterNewRecommendations(results, shownIds, getId).slice(0, batchSize);
}
