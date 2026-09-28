'use client';

import { AISolution } from '@/lib/ai-advisor/types';
import { Button } from '@/components/ui/Button';
import {
  Lightbulb,
  CheckCircle,
  Wrench,
  Clock,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

interface SolutionDisplayProps {
  solution: AISolution;
  onViewRecommendations: () => void;
  onRefineAnswers: () => void;
  isLoading?: boolean;
}

export function SolutionDisplay({
  solution,
  onViewRecommendations,
  onRefineAnswers,
  isLoading = false,
}: SolutionDisplayProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--primary)]/10 mb-4">
          <Lightbulb className="w-8 h-8 text-[var(--primary)]" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-[var(--foreground)]">
          Your Personalized Solution
        </h2>
        <p className="text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Based on our conversation, here's a strategic approach to solve your challenge
        </p>
      </div>

      {/* Solution Summary */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-1">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-3">
              Understanding Your Challenge
            </h3>
            <p className="text-base leading-relaxed text-[var(--foreground)]">
              {solution.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Steps */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Wrench className="w-6 h-6 text-[var(--primary)]" />
          <h3 className="text-xl font-bold text-[var(--foreground)]">
            Actionable Steps
          </h3>
        </div>

        <div className="space-y-4">
          {solution.actionableSteps.map((step, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[var(--primary)]">
                  {index + 1}
                </span>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-base text-[var(--foreground)] leading-relaxed">
                  {step.replace(/^\d+\.\s*/, '')} {/* Remove number prefix if present */}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool Types + Timeline + Budget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Tool Types */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-5 h-5 text-[var(--primary)]" />
            <h4 className="font-bold text-[var(--foreground)]">Tools Needed</h4>
          </div>
          <ul className="space-y-2">
            {solution.toolTypesNeeded.map((tool, index) => (
              <li
                key={index}
                className="text-sm text-[var(--muted-foreground)] flex items-start gap-2"
              >
                <span className="text-[var(--primary)] mt-0.5">•</span>
                <span>{tool}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Timeline */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-[var(--primary)]" />
            <h4 className="font-bold text-[var(--foreground)]">Timeline</h4>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {solution.estimatedImplementationTime}
          </p>
        </div>

        {/* Budget */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-[var(--primary)]" />
            <h4 className="font-bold text-[var(--foreground)]">Budget</h4>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {solution.budgetConsiderations}
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-[var(--primary)]/10 to-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Ready to See Specific Tools?
          </h3>
          <p className="text-base text-[var(--muted-foreground)]">
            Now that you have a solution framework, let's find the best tools to implement it
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onViewRecommendations}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>Analyzing Tools...</>
            ) : (
              <>
                See Tool Recommendations
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={onRefineAnswers}
            disabled={isLoading}
          >
            Refine My Answers
          </Button>
        </div>

        <p className="text-center text-sm text-[var(--muted-foreground)] mt-4">
          💡 We'll match tools from our marketplace that fit this solution
        </p>
      </div>
    </div>
  );
}
