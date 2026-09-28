'use client';

import { useState } from 'react';
import { ClarityBreakdown } from '@/lib/ai-advisor/types';
import { Info } from 'lucide-react';

interface ClarityProgressProps {
  clarityScore: number; // 0-100
  clarityBreakdown?: ClarityBreakdown;
  questionsAsked: number;
  maxQuestions: number;
}

export function ClarityProgress({
  clarityScore,
  clarityBreakdown,
  questionsAsked,
  maxQuestions,
}: ClarityProgressProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Determine color based on score
  const getColorClass = (score: number): string => {
    if (score >= 60) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColorClass = (score: number): string => {
    if (score >= 60) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusText = (score: number): string => {
    if (score >= 60) return 'Great understanding! 🎯';
    if (score >= 40) return 'Getting there... 🔍';
    return 'Need more info 🤔';
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--foreground)] mb-1">
            Understanding Your Needs
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            Question {questionsAsked} of {maxQuestions} • Target: 60% clarity
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
          title="Show clarity breakdown"
        >
          <Info className="w-5 h-5 text-[var(--muted-foreground)]" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-3">
        {/* Background track */}
        <div className="h-4 bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden relative">
          {/* 60% threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--muted-foreground)] opacity-30"
            style={{ left: '60%' }}
          />

          {/* Progress fill */}
          <div
            className={`h-full ${getColorClass(clarityScore)} transition-all duration-500 ease-out relative`}
            style={{ width: `${Math.min(clarityScore, 100)}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Score label */}
        <div className="flex justify-between items-center mt-2">
          <span className={`text-sm font-semibold ${getTextColorClass(clarityScore)}`}>
            {Math.round(clarityScore)}% clarity
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">
            {getStatusText(clarityScore)}
          </span>
        </div>
      </div>

      {/* Breakdown (collapsible) */}
      {showBreakdown && clarityBreakdown && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-3">
            Clarity Breakdown
          </p>

          <BreakdownItem
            label="Problem Detail"
            score={clarityBreakdown.problemSpecificity}
            max={20}
          />
          <BreakdownItem
            label="Category Confidence"
            score={clarityBreakdown.categoryConfidence}
            max={20}
          />
          <BreakdownItem
            label="Questions Answered"
            score={clarityBreakdown.questionsAnswered}
            max={40}
          />
          <BreakdownItem
            label="Context Complete"
            score={clarityBreakdown.contextCompleteness}
            max={20}
          />
        </div>
      )}

      {/* Target indicator */}
      {clarityScore < 60 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            💡 <span className="font-medium">Tip:</span> We'll continue asking questions until we reach
            60% clarity (or {maxQuestions} questions total)
          </p>
        </div>
      )}

      {clarityScore >= 60 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-green-600">
            ✅ <span className="font-medium">Ready!</span> We have enough information to generate a great solution for you.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Breakdown item showing individual score component
 */
function BreakdownItem({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const percentage = (score / max) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--foreground)] min-w-[140px]">
        {label}
      </span>
      <div className="flex-1 h-2 bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-[var(--muted-foreground)] min-w-[50px] text-right">
        {score}/{max}
      </span>
    </div>
  );
}
