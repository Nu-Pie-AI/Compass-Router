'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ProblemInput } from '@/components/ai-advisor/ProblemInput';
import { ClarificationStep } from '@/components/ai-advisor/ClarificationStep';
import { IterativeClarification } from '@/components/ai-advisor/IterativeClarification';
import { SolutionDisplay } from '@/components/ai-advisor/SolutionDisplay';
import { RecommendationCards } from '@/components/ai-advisor/RecommendationCards';
import { ExternalRecommendationCards } from '@/components/ai-advisor/ExternalRecommendationCards';
import { Button } from '@/components/ui/Button';
import { Search, DollarSign, Users, Clock, Star } from 'lucide-react';
import {
  AdvisorPhase,
  IntentResult,
  ScoredOffering,
  ExternalRecommendation,
  AdvisorQuestion,
  ClarityBreakdown,
  AISolution,
} from '@/lib/ai-advisor/types';

export default function AIAdvisorPage() {
  const [phase, setPhase] = useState<AdvisorPhase>('idle');
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [recommendations, setRecommendations] = useState<ScoredOffering[] | null>(
    null
  );
  const [externalRecommendations, setExternalRecommendations] = useState<ExternalRecommendation[] | null>(
    null
  );
  const [fallbackProducts, setFallbackProducts] = useState<ScoredOffering[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [clarityScore, setClarityScore] = useState(0);
  const [clarityBreakdown, setClarityBreakdown] = useState<ClarityBreakdown | undefined>();
  const [currentQuestion, setCurrentQuestion] = useState<AdvisorQuestion | null>(null);
  const [allAnswers, setAllAnswers] = useState<Record<string, string>>({});
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [maxQuestions] = useState(10);
  const [aiSolution, setAiSolution] = useState<AISolution | null>(null);
  const clarifyingRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'analyzing' || phase === 'clarifying') {
      requestAnimationFrame(() => {
        if (clarifyingRef.current) {
          const yOffset = -20;
          const element = clarifyingRef.current;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'results') {
      requestAnimationFrame(() => {
        if (resultsRef.current) {
          const yOffset = -20;
          const element = resultsRef.current;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    }
  }, [phase]);

  const handleProblemSubmit = async (problemDescription: string) => {
    setPhase('analyzing');
    setError(null);

    try {
      const response = await fetch('/api/ai-advisor/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: problemDescription }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze intent');
      }

      const result: IntentResult = await response.json();
      setIntentResult(result);

      if (result.questions && result.questions.length > 0) {
        setCurrentQuestion(result.questions[0]);
        setQuestionsAsked(0);
        setClarityScore(20);
        setAllAnswers({});
        setPhase('clarifying-iterative');
      } else {
        setPhase('clarifying');
      }
    } catch (err) {
      console.error('Intent analysis error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to analyze your problem'
      );
      setPhase('error');
    }
  };

  const handleIterativeAnswer = async (questionId: string, answer: string) => {
    if (!intentResult) return;

    try {
      const updatedAnswers = {
        ...allAnswers,
        [questionId]: answer,
      };
      setAllAnswers(updatedAnswers);

      const response = await fetch('/api/ai-advisor/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: intentResult.conversationId,
          latestAnswer: { questionId, answer },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process answer');
      }

      const result = await response.json();

      setClarityScore(result.clarityScore);
      setClarityBreakdown(result.clarityBreakdown);
      setQuestionsAsked(result.questionsAsked);

      if (!result.shouldContinue || result.clarityScore >= 60) {
        setPhase('generating-solution');
        await generateSolutionHandler();
      } else if (result.nextQuestions && result.nextQuestions.length > 0) {
        setCurrentQuestion(result.nextQuestions[0]);
      } else {
        throw new Error('No next question received');
      }
    } catch (err) {
      console.error('Iterative clarification error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to process your answer'
      );
      setPhase('error');
    }
  };

  const handleSkipClarification = async () => {
    if (clarityScore >= 40) {
      setPhase('generating-solution');
      await generateSolutionHandler();
    }
  };

  const generateSolutionHandler = async () => {
    if (!intentResult) return;

    setError(null);

    try {
      const response = await fetch('/api/ai-advisor/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: intentResult.conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate solution');
      }

      const result = await response.json();
      setAiSolution(result.solution);
      setPhase('solution-display');
    } catch (err) {
      console.error('Solution generation error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate solution'
      );
      setPhase('error');
    }
  };

  const handleViewRecommendations = async () => {
    setPhase('recommending');
    await fetchRecommendations(allAnswers);
  };

  const handleRefineAnswers = () => {
    if (currentQuestion) {
      setPhase('clarifying-iterative');
    }
  };

  const fetchRecommendations = async (answers: Record<string, string>) => {
    if (!intentResult) return;

    setFallbackProducts(null);
    setError(null);

    try {
      const response = await fetch('/api/ai-advisor/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: intentResult.conversationId,
          answers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (
          response.status === 404 &&
          (errorData.error === 'No offerings found' ||
            errorData.message?.includes('No offerings'))
        ) {
          setRecommendations([]);
          const fallback = await fetchFallbackProducts(
            intentResult.detectedCategory
          );
          setFallbackProducts(fallback);
          setPhase('results');
          return;
        }

        throw new Error(errorData.message || 'Failed to get recommendations');
      }

      const result = await response.json();

      if (result.type === 'external' && result.externalRecommendations) {
        setExternalRecommendations(result.externalRecommendations);
        setRecommendations(null);
        setPhase('results');
      } else if (!result.recommendations || result.recommendations.length === 0) {
        setRecommendations([]);
        const fallback = await fetchFallbackProducts(
          intentResult.detectedCategory
        );
        setFallbackProducts(fallback);
        setPhase('results');
      } else {
        setRecommendations(result.recommendations);
        setExternalRecommendations(null);
        setPhase('results');
      }
    } catch (err) {
      console.error('Recommendation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate recommendations'
      );
      setPhase('error');
    }
  };

  const fetchFallbackProducts = async (category?: string) => {
    try {
      const response = await fetch(
        `/api/products/top-rated?category=${category || 'all'}&limit=3`
      );

      if (response.ok) {
        const products = await response.json();
        return products;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch fallback products:', error);
      return [];
    }
  };

  const handleAnswersSubmit = async (answers: Record<string, string>) => {
    if (!intentResult) return;

    setPhase('recommending');
    setError(null);
    setFallbackProducts(null);

    try {
      const response = await fetch('/api/ai-advisor/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: intentResult.conversationId,
          answers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (
          response.status === 404 &&
          (errorData.error === 'No offerings found' ||
            errorData.message?.includes('No offerings'))
        ) {
          setRecommendations([]);
          const fallback = await fetchFallbackProducts(intentResult.detectedCategory);
          setFallbackProducts(fallback);
          setPhase('results');
          return;
        }

        throw new Error(errorData.message || 'Failed to get recommendations');
      }

      const result = await response.json();

      if (result.type === 'external' && result.externalRecommendations) {
        setExternalRecommendations(result.externalRecommendations);
        setRecommendations(null);
        setPhase('results');
      } else if (!result.recommendations || result.recommendations.length === 0) {
        setRecommendations([]);
        const fallback = await fetchFallbackProducts(intentResult.detectedCategory);
        setFallbackProducts(fallback);
        setPhase('results');
      } else {
        setRecommendations(result.recommendations);
        setExternalRecommendations(null);
        setPhase('results');
      }
    } catch (err) {
      console.error('Recommendation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate recommendations'
      );
      setPhase('error');
    }
  };

  const handleStartOver = () => {
    setPhase('idle');
    setIntentResult(null);
    setRecommendations(null);
    setExternalRecommendations(null);
    setFallbackProducts(null);
    setError(null);
    setClarityScore(0);
    setClarityBreakdown(undefined);
    setCurrentQuestion(null);
    setAllAnswers({});
    setQuestionsAsked(0);
    setAiSolution(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto">
        {phase === 'idle' && (
          <ProblemInput onSubmit={handleProblemSubmit} isLoading={false} />
        )}

        {phase === 'analyzing' && (
          <div ref={clarifyingRef} className="max-w-3xl mx-auto text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-xl font-medium text-[var(--foreground)]">Analyzing your needs...</p>
            <p className="text-[var(--muted-foreground)] mt-2">
              Understanding your problem and preparing questions
            </p>
          </div>
        )}

        {phase === 'clarifying-iterative' && intentResult && currentQuestion && (
          <div ref={clarifyingRef}>
            <IterativeClarification
              conversationId={intentResult.conversationId}
              currentQuestion={currentQuestion}
              answeredQuestions={allAnswers}
              allQuestions={intentResult.questions}
              clarityScore={clarityScore}
              clarityBreakdown={clarityBreakdown}
              questionsAsked={questionsAsked}
              maxQuestions={maxQuestions}
              onAnswerSubmit={handleIterativeAnswer}
              onSkipToSolution={handleSkipClarification}
              isLoading={false}
            />
          </div>
        )}

        {phase === 'clarifying' && intentResult && (
          <div ref={clarifyingRef}>
            <ClarificationStep
              questions={intentResult.questions}
              detectedIntent={intentResult.detectedIntent}
              onSubmit={handleAnswersSubmit}
              isLoading={false}
            />
          </div>
        )}

        {phase === 'generating-solution' && (
          <div className="max-w-3xl mx-auto text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-xl font-medium text-[var(--foreground)]">
              Crafting your personalized solution...
            </p>
            <p className="text-[var(--muted-foreground)] mt-2">
              Analyzing your needs and creating a strategic action plan
            </p>
          </div>
        )}

        {phase === 'solution-display' && aiSolution && (
          <div ref={resultsRef}>
            <SolutionDisplay
              solution={aiSolution}
              onViewRecommendations={handleViewRecommendations}
              onRefineAnswers={handleRefineAnswers}
              isLoading={false}
            />
          </div>
        )}

        {phase === 'recommending' && (
          <div className="max-w-3xl mx-auto text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-xl font-medium text-[var(--foreground)]">
              Finding tools that match your solution...
            </p>
            <p className="text-[var(--muted-foreground)] mt-2">
              Analyzing marketplace offerings and calculating fit scores
            </p>
          </div>
        )}

        {phase === 'results' && recommendations && recommendations.length > 0 && (
          <div ref={resultsRef}>
            <RecommendationCards
              recommendations={recommendations}
              onStartOver={handleStartOver}
              aiSolution={aiSolution}
            />
          </div>
        )}

        {phase === 'results' && externalRecommendations && externalRecommendations.length > 0 && (
          <div ref={resultsRef}>
            <ExternalRecommendationCards
              recommendations={externalRecommendations}
              onStartOver={handleStartOver}
            />
          </div>
        )}

        {phase === 'results' && recommendations && recommendations.length === 0 && !externalRecommendations && (
          <div ref={resultsRef} className="max-w-4xl mx-auto">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center mb-6">
              <div className="text-[var(--primary)] mb-4">
                <Search className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-3">
                We couldn&apos;t find an exact match for your needs
              </h2>
              <p className="text-[var(--muted-foreground)] mb-6 max-w-2xl mx-auto">
                Don&apos;t worry! This just means we need to adjust the search criteria.
                Your specific requirements might be more unique than our current
                solution catalog.
              </p>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-[var(--foreground)] mb-4">
                  Try adjusting your requirements:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[var(--foreground)]">Broaden your budget range</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Consider a slightly higher budget for more options
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[var(--foreground)]">Adjust team size</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Some solutions work well for different team sizes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[var(--foreground)]">Modify urgency</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Allow more time for implementation and setup
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Star className="w-6 h-6 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        Explore top-rated solutions
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Check popular options in{' '}
                        {intentResult?.detectedCategory || 'this category'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary" size="lg" onClick={handleStartOver}>
                  Start Over
                </Button>
                {intentResult && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.location.href = `/browse?category=${intentResult.detectedCategory}`}
                  >
                    Browse All {intentResult.detectedCategory.toUpperCase()} Solutions
                  </Button>
                )}
              </div>
            </div>

            {fallbackProducts && fallbackProducts.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-[var(--foreground)] mb-4 text-center">
                  Here are some popular alternatives you may want to explore
                </h3>
                <p className="text-[var(--muted-foreground)] text-center mb-6">
                  Top-rated solutions in {intentResult?.detectedCategory || 'this category'} that might work for you
                </p>
                <div className="space-y-4">
                  {fallbackProducts.map((scored) => (
                    <div
                      key={scored.offering.id}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {scored.offering.logo && (
                          <Image
                            src={scored.offering.logo}
                            alt={scored.offering.title}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-contain rounded"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-lg font-bold text-[var(--foreground)]">
                                {scored.offering.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-yellow-500">★</span>
                                <span className="font-semibold text-[var(--foreground)]">
                                  {scored.offering.averageRating.toFixed(1)}
                                </span>
                                <span className="text-[var(--muted-foreground)] text-sm">
                                  ({scored.offering.reviewCount} reviews)
                                </span>
                              </div>
                            </div>
                            {scored.offering.startingPrice && (
                              <div className="text-right">
                                <div className="text-2xl font-bold text-[var(--primary)]">
                                  ${scored.offering.startingPrice}
                                </div>
                                <div className="text-sm text-[var(--muted-foreground)]">per month</div>
                              </div>
                            )}
                          </div>
                          <p className="text-[var(--muted-foreground)] mb-4">
                            {scored.offering.shortDescription}
                          </p>
                          <div className="flex gap-3">
                            <Button
                              variant="primary"
                              onClick={() => window.location.href = `/offerings/${scored.offering.slug}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={handleStartOver}
              >
                ← Start a new search
              </Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="text-red-600 text-4xl mb-4">⚠️</div>
              <h2 className="text-xl sm:text-2xl font-bold text-red-900 mb-2">
                Oops! Something went wrong
              </h2>
              <p className="text-red-800 mb-6">{error}</p>
              <Button variant="danger" size="lg" onClick={handleStartOver}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <div className="max-w-3xl mx-auto mt-8 p-4 bg-[var(--surface)] border border-[var(--border)] rounded text-xs">
            <p className="text-[var(--foreground)]">
              <strong>Phase:</strong> {phase}
            </p>
            {intentResult && (
              <p className="text-[var(--foreground)]">
                <strong>Detected Category:</strong>{' '}
                {intentResult.detectedCategory}
              </p>
            )}
            {recommendations && (
              <p className="text-[var(--foreground)]">
                <strong>Recommendations:</strong> {recommendations.length} offerings
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
