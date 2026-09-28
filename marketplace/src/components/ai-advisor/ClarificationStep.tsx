'use client';

import { useState } from 'react';
import { AdvisorQuestion } from '@/lib/ai-advisor/types';
import { Button } from '@/components/ui/Button';

interface ClarificationStepProps {
  questions: AdvisorQuestion[];
  detectedIntent: string;
  onSubmit: (answers: Record<string, string>) => void;
  isLoading: boolean;
}

export function ClarificationStep({
  questions,
  detectedIntent,
  onSubmit,
  isLoading,
}: ClarificationStepProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(answers).length === questions.length) {
      onSubmit(answers);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const allQuestionsAnswered = Object.keys(answers).length === questions.length;
  const progress = (Object.keys(answers).length / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-[var(--foreground)]">Perfect! Let's refine your search</h2>
        <p className="text-base sm:text-lg text-[var(--muted-foreground)]">
          You're looking for: <span className="font-semibold text-[var(--foreground)]">{detectedIntent}</span>
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--muted-foreground)]">Progress</span>
          <span className="font-medium text-[var(--foreground)]">
            {Object.keys(answers).length} of {questions.length} questions
          </span>
        </div>
        <div className="h-2 bg-[var(--surface)] border border-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6"
          >
            <label className="block mb-4">
              <span className="text-sm font-medium text-[var(--muted-foreground)] uppercase">
                Question {index + 1} of {questions.length}
              </span>
              <span className="block text-lg font-semibold mt-1 text-[var(--foreground)]">
                {question.text}
              </span>
            </label>

            <div className="space-y-3">
              {question.options.map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    answers[question.id] === option
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] hover:border-[var(--border)]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={(e) =>
                      handleAnswerChange(question.id, e.target.value)
                    }
                    className="w-4 h-4 text-[var(--primary)]"
                    disabled={isLoading}
                  />
                  <span className="ml-3 text-[var(--foreground)] font-medium">
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <Button
          type="submit"
          disabled={!allQuestionsAnswered || isLoading}
          variant="primary"
          size="lg"
          className="w-full text-lg"
        >
          {isLoading ? 'Finding best matches...' : 'Get My Recommendations'}
        </Button>
      </form>
    </div>
  );
}
