'use client';

import { useState } from 'react';
import { MessageCircle, Send, SkipForward } from 'lucide-react';

interface ClarificationQuestion {
  questionId: string;
  question: string;
  context: string;
}

interface ClarificationChatProps {
  questions: ClarificationQuestion[];
  onSubmit: (clarifications: Record<string, string>) => void;
  onSkip: () => void;
  confidenceScore?: number;
}

export function ClarificationChat({
  questions,
  onSubmit,
  onSkip,
  confidenceScore,
}: ClarificationChatProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAnswer.trim()) return;

    const newAnswers = {
      ...answers,
      [currentQuestion.questionId]: currentAnswer.trim(),
    };

    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onSubmit(newAnswers);
    }
  };

  const handleSkipQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      return;
    }

    if (Object.keys(answers).length > 0) {
      onSubmit(answers);
    } else {
      onSkip();
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl shadow-md border border-[var(--border)] overflow-hidden">
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
              Help Us Complete Your Profile
            </h2>
            <p className="text-base text-[var(--muted-foreground)]">
              Answer a few quick questions to improve your offering&apos;s quality
            </p>
          </div>
          {confidenceScore !== undefined && (
            <div className="flex flex-col items-end">
              <span className="text-xs text-[var(--muted-foreground)] mb-1">
                Confidence
              </span>
              <span className="text-4xl font-bold text-[#4DBC65]">
                {confidenceScore}%
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-[var(--muted-foreground)]">
              {answeredCount} answered
            </span>
          </div>
          <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4DBC65] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6 min-h-[320px] flex flex-col gap-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-[#4DBC65]/10 rounded-full flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-[#4DBC65]" />
          </div>
          <div className="flex-1">
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl rounded-tl-none p-5">
              <p className="text-base font-medium text-[var(--foreground)] mb-2">
                {currentQuestion.question}
              </p>
              <p className="text-sm text-[var(--muted-foreground)] leading-6">
                {currentQuestion.context}
              </p>
            </div>
          </div>
        </div>

        {currentQuestionIndex > 0 && answeredCount > 0 && (
          <div className="flex justify-end">
            <div className="bg-[#4DBC65]/10 border border-[#4DBC65]/20 rounded-2xl rounded-tr-none px-4 py-3 max-w-md">
              <p className="text-sm text-[var(--foreground)]">
                {answeredCount} question{answeredCount > 1 ? 's' : ''} answered
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleAnswerSubmit} className="mt-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={5}
              className="flex-1 px-4 py-4 border border-[var(--border)] rounded-2xl bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[#4DBC65]/25 focus:border-[#4DBC65] resize-none shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleAnswerSubmit(e);
                }
              }}
            />

            <div className="flex gap-3 md:flex-col md:w-40">
              <button
                type="submit"
                disabled={!currentAnswer.trim()}
                className="flex-1 md:flex-none px-4 py-3 bg-[#4DBC65] hover:bg-[#3fa656] text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <Send className="w-4 h-4" />
                {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish'}
              </button>

              <button
                type="button"
                onClick={handleSkipQuestion}
                className="flex-1 md:flex-none px-4 py-3 border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Press Ctrl+Enter to submit
          </p>
        </form>
      </div>

      <div className="p-4 bg-[var(--background)] border-t border-[var(--border)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          You can skip questions or create with current information
        </p>
        <button
          type="button"
          onClick={() => {
            if (Object.keys(answers).length > 0) {
              onSubmit(answers);
            } else {
              onSkip();
            }
          }}
          className="text-sm text-[#4DBC65] hover:text-[#3fa656] font-medium"
        >
          Create with Current Info →
        </button>
      </div>
    </div>
  );
}
