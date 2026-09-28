'use client';

import { useState } from 'react';
import { AISolution } from '@/lib/ai-advisor/types';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface SolutionRecapProps {
  solution: AISolution;
}

export function SolutionRecap({ solution }: SolutionRecapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-[var(--primary)]/10 to-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl p-6 mb-8">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-1">
            <Lightbulb className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">
              Your Strategic Solution
            </h3>
            {!isExpanded && (
              <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                {solution.summary}
              </p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--muted-foreground)]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--primary)]/20">
          {/* Summary */}
          <div className="mb-6">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {solution.summary}
            </p>
          </div>

          {/* Actionable Steps */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
              Implementation Steps
            </h4>
            <div className="space-y-2">
              {solution.actionableSteps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed pt-0.5">
                    {step.replace(/^\d+\.\s*/, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--primary)]/20">
            <p className="text-xs text-[var(--muted-foreground)] italic">
              💡 The tools below are matched to help you implement this solution
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
