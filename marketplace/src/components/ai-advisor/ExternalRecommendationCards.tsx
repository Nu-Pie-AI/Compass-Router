'use client';

import { ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ExternalRecommendation {
  id: string;
  productName: string;
  productUrl: string | null;
  category: string;
  shortDescription: string;
  reasoning: string;
  confidence: number;
}

interface ExternalRecommendationCardsProps {
  recommendations: ExternalRecommendation[];
  onStartOver: () => void;
}

export function ExternalRecommendationCards({
  recommendations,
  onStartOver,
}: ExternalRecommendationCardsProps) {
  const handleRecommendationClick = async (recId: string) => {
    try {
      await fetch(`/api/ai-advisor/external/${recId}/click`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to track click:', error);
      // Don't block the user if tracking fails
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header with External Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full mb-4 border border-blue-500/20">
          <Globe className="w-5 h-5" />
          <span className="font-semibold">External Suggestions</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-[var(--foreground)]">
          We don't have matching solutions yet
        </h2>
        <p className="text-base sm:text-lg text-[var(--muted-foreground)]">
          Here are some popular external products that might help:
        </p>
      </div>

      <div className="space-y-6">
        {recommendations.map((rec, index) => {
          const confidencePercentage = Math.round(rec.confidence * 100);

          return (
            <div
              key={rec.id}
              className="bg-[var(--surface)] border-2 border-blue-500/20 rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              {/* Rank Badge */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    #{index + 1}
                  </div>
                </div>

                <div className="flex-1">
                  {/* Product Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-[var(--foreground)]">
                          {rec.productName}
                        </h3>
                        <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                          External
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)] mt-1">
                        {rec.category}
                      </p>
                    </div>

                    {/* Confidence Score */}
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        {confidencePercentage}%
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        Confidence
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[var(--muted-foreground)] mb-4">
                    {rec.shortDescription}
                  </p>

                  {/* AI Reasoning */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                      Why we recommend this:
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">{rec.reasoning}</p>
                  </div>

                  {/* Action Button */}
                  {rec.productUrl ? (
                    <a
                      href={rec.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleRecommendationClick(rec.id)}
                    >
                      <Button className="w-full sm:w-auto">
                        Visit Official Website →
                      </Button>
                    </a>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      variant="secondary"
                      disabled
                    >
                      No website available
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={onStartOver} variant="secondary">
          Start Over
        </Button>
        <a href="/browse">
          <Button variant="secondary">Browse Our Marketplace</Button>
        </a>
      </div>

      {/* Help Message */}
      <div className="mt-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        <p className="text-[var(--muted-foreground)] mb-2">
          We're constantly adding new solutions to our marketplace.
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          Check back soon or{' '}
          <a
            href="/browse"
            className="text-[var(--primary)] hover:underline font-medium"
          >
            browse our current offerings
          </a>
          .
        </p>
      </div>
    </div>
  );
}
