'use client';

import Link from 'next/link';
import { ScoredOffering, AISolution } from '@/lib/ai-advisor/types';
import { Button } from '@/components/ui/Button';
import { SolutionRecap } from './SolutionRecap';

interface RecommendationCardsProps {
  recommendations: ScoredOffering[];
  onStartOver: () => void;
  aiSolution?: AISolution | null; // Optional AI solution for context
}

export function RecommendationCards({
  recommendations,
  onStartOver,
  aiSolution,
}: RecommendationCardsProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-[var(--foreground)]">
          {aiSolution ? 'Tools to Implement Your Solution' : `Here are your top ${recommendations.length} matches`}
        </h2>
        <p className="text-base sm:text-lg text-[var(--muted-foreground)]">
          {aiSolution
            ? 'These tools align with your strategic plan and will help you achieve your goals'
            : 'Ranked by how well they match your specific needs'}
        </p>
      </div>

      {/* Solution Recap (if available) */}
      {aiSolution && <SolutionRecap solution={aiSolution} />}

      <div className="space-y-6">
        {recommendations.map((scored, index) => {
          const offering = scored.offering;
          const matchPercentage = Math.round(scored.matchScore);

          return (
            <div
              key={offering.id}
              className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              {/* Rank Badge */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[var(--primary)] text-white rounded-full flex items-center justify-center font-bold text-xl">
                    #{index + 1}
                  </div>
                </div>

                <div className="flex-1">
                  {/* Product Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {offering.logo && (
                        <img
                          src={offering.logo}
                          alt={offering.title}
                          className="w-12 h-12 object-contain rounded"
                        />
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-[var(--foreground)]">{offering.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-yellow-500">★</span>
                          <span className="font-semibold text-[var(--foreground)]">
                            {offering.averageRating.toFixed(1)}
                          </span>
                          <span className="text-[var(--muted-foreground)] text-sm">
                            ({offering.reviewCount} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Match Score */}
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[var(--primary)]">
                        {matchPercentage}%
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">Match</div>
                    </div>
                  </div>

                  {/* Product Description */}
                  <p className="text-[var(--muted-foreground)] mb-4">
                    {offering.shortDescription}
                  </p>

                  {/* AI Reasoning */}
                  <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                          Why this is a great match:
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {scored.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                      Match breakdown:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <ScoreItem
                        label="Category"
                        score={scored.scoreBreakdown.categoryMatch}
                        max={30}
                      />
                      <ScoreItem
                        label="Team Size"
                        score={scored.scoreBreakdown.teamSizeMatch}
                        max={15}
                      />
                      <ScoreItem
                        label="Budget"
                        score={scored.scoreBreakdown.budgetMatch}
                        max={15}
                      />
                      <ScoreItem
                        label="Use Case"
                        score={scored.scoreBreakdown.useCaseMatch}
                        max={20}
                      />
                      <ScoreItem
                        label="Target Customer"
                        score={scored.scoreBreakdown.targetCustomerMatch}
                        max={10}
                      />
                      <ScoreItem
                        label="Rating"
                        score={scored.scoreBreakdown.ratingScore}
                        max={10}
                      />
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="flex flex-wrap gap-3 mb-4 text-sm">
                    {offering.pricingModel && (
                      <span className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-full">
                        {offering.pricingModel}
                        {offering.startingPrice &&
                          ` - $${offering.startingPrice}/mo`}
                      </span>
                    )}
                    {offering.hasFreeTrial && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                        Free Trial Available
                      </span>
                    )}
                    {offering.offeringType && (
                      <span className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full capitalize">
                        {offering.offeringType.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {/* Features */}
                  {offering.features.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                        Key features:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {offering.features.slice(0, 5).map((feature) => (
                          <span
                            key={feature.name}
                            className="text-xs px-2 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] rounded"
                          >
                            {feature.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={`/offerings/${offering.slug}`}
                      className="flex-1"
                    >
                      <Button variant="primary" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link
                      href={`/offerings/${offering.slug}`}
                    >
                      <Button variant="outline" className="w-full sm:w-auto">
                        Compare
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Start Over Button */}
      <div className="mt-8 text-center">
        <Button
          variant="ghost"
          onClick={onStartOver}
        >
          ← Start a new search
        </Button>
      </div>
    </div>
  );
}

function ScoreItem({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const percentage = (score / max) * 100;
  const displayScore = score % 1 === 0 ? score : parseFloat(score.toFixed(1));

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-medium text-[var(--foreground)]">
          {displayScore}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
