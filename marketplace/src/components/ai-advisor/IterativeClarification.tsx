'use client';

import { useState, useEffect, useRef } from 'react';
import { AdvisorQuestion, ClarityBreakdown } from '@/lib/ai-advisor/types';
import { Button } from '@/components/ui/Button';
import { ClarityProgress } from './ClarityProgress';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface IterativeClarificationProps {
  conversationId: string;
  currentQuestion: AdvisorQuestion;
  answeredQuestions: Record<string, string>;
  allQuestions: AdvisorQuestion[];
  clarityScore: number;
  clarityBreakdown?: ClarityBreakdown;
  questionsAsked: number;
  maxQuestions: number;
  onAnswerSubmit: (questionId: string, answer: string) => Promise<void>;
  onBack?: () => void;
  onSkipToSolution: () => void;
  isLoading: boolean;
}

export function IterativeClarification({
  conversationId,
  currentQuestion,
  answeredQuestions,
  allQuestions,
  clarityScore,
  clarityBreakdown,
  questionsAsked,
  maxQuestions,
  onAnswerSubmit,
  onBack,
  onSkipToSolution,
  isLoading,
}: IterativeClarificationProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showAnsweredQuestions, setShowAnsweredQuestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new question
  useEffect(() => {
    if (containerRef.current) {
      const yOffset = -40; 
      const y = containerRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [currentQuestion.id]);

  const toggleOption = (option: string) => {
    if (currentQuestion.allowMultiple === false) {
      // Single-select mode: immediately submit it without requiring the 'submit' button click
      setSelectedAnswers([option]);
      onAnswerSubmit(currentQuestion.id, option);
      setSelectedAnswers([]);
    } else {
      // Multi-select mode: toggle in string array
      setSelectedAnswers((prev) =>
        prev.includes(option)
          ? prev.filter((a) => a !== option)
          : [...prev, option]
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAnswers.length === 0) return;

    await onAnswerSubmit(currentQuestion.id, selectedAnswers.join(', '));
    setSelectedAnswers([]); // Reset for next question
  };

  const canSkip = clarityScore >= 40;

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-[var(--foreground)]">
          Let's understand your needs better
        </h2>
        <p className="text-base sm:text-lg text-[var(--muted-foreground)]">
          Answer a few questions so we can provide the best solution for you
        </p>
      </div>

      {/* Clarity Progress */}
      <ClarityProgress
        clarityScore={clarityScore}
        clarityBreakdown={clarityBreakdown}
        questionsAsked={questionsAsked}
        maxQuestions={maxQuestions}
      />

      {/* Current Question */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <label className="block mb-6">
            <span className="text-sm font-medium text-[var(--muted-foreground)] uppercase">
              Question {questionsAsked + 1}
            </span>
            <span className="block text-xl font-semibold mt-2 text-[var(--foreground)]">
              {currentQuestion.text}
            </span>
          </label>

          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option) => (
              <label
                key={option}
                className={`
                  flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${
                    selectedAnswers.includes(option)
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]'
                  }
                `}
              >
                <input
                  type={currentQuestion.allowMultiple === false ? "radio" : "checkbox"}
                  name={currentQuestion.id}
                  value={option}
                  checked={selectedAnswers.includes(option)}
                  onChange={() => toggleOption(option)}
                  className={`mr-3 w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)] ${currentQuestion.allowMultiple === false ? '' : 'rounded'}`}
                  disabled={isLoading}
                />
                <span className="text-base font-medium text-[var(--foreground)]">
                  {option}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {onBack && questionsAsked > 0 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onBack}
                disabled={isLoading}
                className="flex-shrink-0"
              >
                Back
              </Button>
            )}

            {currentQuestion.allowMultiple !== false && (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={selectedAnswers.length === 0 || isLoading}
                className="flex-1"
              >
                {isLoading ? 'Analyzing...' : 'Submit Answer'}
              </Button>
            )}

            {canSkip && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onSkipToSolution}
                disabled={isLoading}
                className="flex-1"
              >
                Skip to Solution →
              </Button>
            )}
          </div>

          {canSkip && (
            <p className="text-sm text-[var(--muted-foreground)] mt-3 text-center">
              You have enough clarity to generate a solution, but answering more questions
              will improve recommendations
            </p>
          )}
        </form>
      </div>

      {/* Answered Questions (Collapsible) */}
      {Object.keys(answeredQuestions).length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
          <button
            type="button"
            onClick={() => setShowAnsweredQuestions(!showAnsweredQuestions)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              Answered Questions ({Object.keys(answeredQuestions).length})
            </h3>
            {showAnsweredQuestions ? (
              <ChevronUp className="w-5 h-5 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--muted-foreground)]" />
            )}
          </button>

          {showAnsweredQuestions && (
            <div className="mt-4 space-y-3 pt-4 border-t border-[var(--border)]">
              {allQuestions.map((q) => {
                const answer = answeredQuestions[q.id];
                if (!answer) return null;

                return (
                  <div key={q.id} className="pb-3 border-b border-[var(--border)] last:border-0">
                    <p className="text-sm font-medium text-[var(--muted-foreground)] mb-1">
                      {q.text}
                    </p>
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {answer}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
