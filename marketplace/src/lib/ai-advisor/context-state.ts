import {
  AdvisorContext,
  AdvisorKnownFacts,
  AdvisorMode,
  RecommendationSource,
  TurnIntent,
} from './types';
import { knownFactsToAnswers, mergeKnownFacts } from './facts';

export function hydrateAdvisorContext(
  context: AdvisorContext
): AdvisorContext {
  const facts = mergeKnownFacts(context.knownFacts || context.facts, {
    ...(context.facts || {}),
    ...(context.knownFacts || {}),
  });
  const recommendationSource =
    context.recommendationSource ||
    context.lastRecommendationType ||
    (context.shownExternalIds && context.shownExternalIds.length > 0
      ? 'external'
      : context.shownInternalIds && context.shownInternalIds.length > 0
        ? 'internal'
        : null);

  const mode =
    context.mode ||
    deriveModeFromContext({
      ...context,
      recommendationSource,
    });

  return {
    ...context,
    mode,
    facts,
    knownFacts: facts,
    answers: {
      ...(context.answers || {}),
      ...knownFactsToAnswers(facts),
    },
    currentNeedSummary:
      context.currentNeedSummary || context.detectedIntent || context.problem,
    recommendationSource,
    availableExternalIds:
      context.availableExternalIds || context.externalRecommendationIds || [],
    lastAssistantIntent: context.lastAssistantIntent || null,
  };
}

export function withAdvisorState(
  context: AdvisorContext,
  updates: Partial<AdvisorContext> & {
    facts?: AdvisorKnownFacts;
    knownFacts?: AdvisorKnownFacts;
    mode?: AdvisorMode;
    recommendationSource?: RecommendationSource | null;
    lastAssistantIntent?: TurnIntent | null;
  }
): AdvisorContext {
  const mergedFacts = mergeKnownFacts(
    context.facts || context.knownFacts,
    updates.facts || updates.knownFacts
  );

  return hydrateAdvisorContext({
    ...context,
    ...updates,
    facts: mergedFacts,
    knownFacts: mergedFacts,
  });
}

function deriveModeFromContext(context: AdvisorContext): AdvisorMode {
  if (context.recommendationExhausted) {
    return 'exhausted';
  }

  if (context.phase === 'clarifying' || context.phase === 'clarifying-iterative') {
    return 'clarifying';
  }

  if (context.phase === 'solution-generated' && !hasRecommendations(context)) {
    return 'awaiting_recommendation_consent';
  }

  if (context.aiSolution && !hasRecommendations(context)) {
    return 'solution';
  }

  if (context.recommendationSource === 'internal') {
    return 'recommending_internal';
  }

  if (context.recommendationSource === 'external') {
    return 'recommending_external';
  }

  return 'advising';
}

function hasRecommendations(context: AdvisorContext) {
  return Boolean(
    (context.shownInternalIds && context.shownInternalIds.length > 0) ||
      (context.shownExternalIds && context.shownExternalIds.length > 0) ||
      (context.recommendationIds && context.recommendationIds.length > 0) ||
      (context.externalRecommendationIds &&
        context.externalRecommendationIds.length > 0)
  );
}
