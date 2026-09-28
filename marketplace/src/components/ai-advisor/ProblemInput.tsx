'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ProblemInputProps {
  onSubmit: (problem: string) => void;
  isLoading: boolean;
}

export function ProblemInput({ onSubmit, isLoading }: ProblemInputProps) {
  const [problem, setProblem] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (problem.trim().length >= 10) {
      onSubmit(problem.trim());
    }
  };

  const exampleProblems = [
    'We struggle to track sales leads and follow-ups',
    'Need better inventory management for our warehouse',
    'Looking for project management software for our team',
    'Want to automate our accounting and invoicing',
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-[var(--foreground)]">
          Find the Perfect Solution for Your Business
        </h1>
        <p className="text-lg sm:text-xl text-[var(--muted-foreground)]">
          Tell us what challenge you're facing, and we'll recommend the best
          solutions for you
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="problem" className="block text-sm font-medium mb-2 text-[var(--foreground)]">
            What business challenge are you trying to solve?
          </label>
          <textarea
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Example: We need a CRM to manage our sales pipeline and track customer interactions..."
            className="w-full h-32 px-4 py-3 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-none"
            disabled={isLoading}
            required
            minLength={10}
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-[var(--muted-foreground)]">
              {problem.length}/1000 characters {problem.length < 10 && '(minimum 10)'}
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">
              {problem.trim().length >= 10 ? '✓ Ready' : ''}
            </span>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading || problem.trim().length < 10}
          variant="primary"
          size="lg"
          className="w-full"
        >
          {isLoading ? 'Analyzing...' : 'Get Recommendations'}
        </Button>
      </form>

      <div className="mt-8">
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">
          Need inspiration? Try these examples:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {exampleProblems.map((example, index) => (
            <button
              key={index}
              onClick={() => setProblem(example)}
              className="text-left px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface)]/80 rounded-lg text-sm text-[var(--foreground)] border border-[var(--border)] transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
