'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { InputForm } from '@/components/ai-onboarding/InputForm';
import { ProcessingLoader } from '@/components/ai-onboarding/ProcessingLoader';
import { ClarificationChat } from '@/components/ai-onboarding/ClarificationChat';
import { SuccessMessage } from '@/components/ai-onboarding/SuccessMessage';

type Phase = 'input' | 'processing' | 'clarifying' | 'preview' | 'complete';

type ProcessingStage = 'extracting' | 'generating' | 'finalizing';

interface OnboardingState {
  sessionId: string | null;
  offeringName: string;
  offeringSummary: string;
  websiteUrl?: string;
  allowWebBrowsing: 'yes' | 'no' | 'not-sure';
  uploadedFileUrls?: string[];

  // Processing
  currentStage?: ProcessingStage;

  // Clarification
  missingQuestions?: string[];
  clarificationNeeded?: Array<{
    questionId: string;
    question: string;
    context: string;
  }>;

  // Results
  confidenceScore?: number;
  estimatedCompleteness?: number;
  offeringId?: string;
  slug?: string;
  status?: 'published' | 'pending_review' | 'draft';
  redirectUrl?: string;
}

export default function CreateAIOfferingPage() {
  const [phase, setPhase] = useState<Phase>('input');
  const [state, setState] = useState<OnboardingState>({
    sessionId: null,
    offeringName: '',
    offeringSummary: '',
    allowWebBrowsing: 'not-sure',
  });
  const [error, setError] = useState<string>('');
  const isCompactPhase = phase !== 'input';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase, state.currentStage]);

  // Step 1: Handle input form submission
  const handleInputSubmit = async (formData: {
    offeringName: string;
    offeringSummary: string;
    websiteUrl?: string;
    allowWebBrowsing: 'yes' | 'no' | 'not-sure';
    uploadedFileUrls?: string[];
  }) => {
    try {
      setError('');
      setPhase('processing');
      setState((prev) => ({ ...prev, ...formData }));

      // Start session
      const startResponse = await fetch('/api/partners/offerings/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Failed to start session');
      }

      const startData = await startResponse.json();
      setState((prev) => ({
        ...prev,
        sessionId: startData.sessionId,
        currentStage: startData.nextAction === 'extracting' ? 'extracting' : 'generating',
      }));

      // Always run Stage 1 so summary-only flows still get structured context
      await runContextExtraction(startData.sessionId);

      // Run Stage 2 (intelligence generation)
      await runIntelligenceGeneration(startData.sessionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start AI onboarding');
      setPhase('input');
    }
  };

  // Step 2: Context extraction (Stage 1)
  const runContextExtraction = async (sessionId: string) => {
    setState((prev) => ({ ...prev, currentStage: 'extracting' }));

    const response = await fetch('/api/partners/offerings/ai/extract-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      console.warn('Context extraction failed, continuing anyway...');
    }
  };

  // Step 3: Intelligence generation (Stage 2)
  const runIntelligenceGeneration = async (sessionId: string) => {
    setState((prev) => ({ ...prev, currentStage: 'generating' }));

    const response = await fetch('/api/partners/offerings/ai/generate-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate intelligence');
    }

    const data = await response.json();

    // Check if clarification needed
    if (data.missingQuestions && data.missingQuestions.length > 0) {
      setState((prev) => ({
        ...prev,
        missingQuestions: data.missingQuestions,
        clarificationNeeded: data.clarificationNeeded,
        confidenceScore: data.confidenceScore,
        estimatedCompleteness: data.estimatedCompleteness,
      }));
      setPhase('clarifying');
    } else {
      // No clarification needed, go straight to preview
      await handleFinalize(sessionId);
    }
  };

  // Step 4: Handle clarifications
  const handleClarificationSubmit = async (clarifications: Record<string, string>) => {
    try {
      setError('');
      setPhase('processing');
      setState((prev) => ({ ...prev, currentStage: 'generating' }));

      const response = await fetch('/api/partners/offerings/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          clarifications,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refine answers');
      }

      const data = await response.json();

      if (data.readyToFinalize) {
        await handleFinalize(state.sessionId!);
      } else {
        // Still have missing questions
        setState((prev) => ({
          ...prev,
          missingQuestions: data.stillMissing,
          clarificationNeeded: data.clarificationNeeded,
          confidenceScore: data.confidenceScore,
        }));
        setPhase('clarifying');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refine answers');
      setPhase('clarifying');
    }
  };

  // Step 5: Finalize and create offering
  const handleFinalize = async (sessionId: string) => {
    setState((prev) => ({ ...prev, currentStage: 'finalizing' }));

    const response = await fetch('/api/partners/offerings/ai/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, forceCreate: true }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create offering');
    }

    const data = await response.json();

    setState((prev) => ({
      ...prev,
      offeringId: data.offeringId,
      slug: data.slug,
      status: data.status,
      confidenceScore: data.confidenceScore,
      redirectUrl: data.redirectUrl,
    }));

    setPhase('complete');
  };

  // Handle restart
  const handleRestart = () => {
    setState({
      sessionId: null,
      offeringName: '',
      offeringSummary: '',
      allowWebBrowsing: 'not-sure',
    });
    setPhase('input');
    setError('');
  };

  return (
    <div
      className={`min-h-screen bg-[var(--background)] ${
        isCompactPhase ? 'py-4 sm:py-6' : 'py-6 sm:py-8'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm ${isCompactPhase ? 'mb-4 sm:mb-5' : 'mb-8'}`}>
          <div className="absolute inset-0 bg-mesh opacity-35" />
          <div className="relative">
          <div
            className={`inline-flex items-center gap-2 bg-[#4DBC65]/10 text-[#4DBC65] rounded-full text-sm font-medium ${
              isCompactPhase ? 'px-3 py-1.5 mb-3' : 'px-4 py-2 mb-4'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI-Powered Onboarding
          </div>
          <h1
            className={`font-bold text-[var(--foreground)] mb-2 ${
              isCompactPhase ? 'text-2xl sm:text-3xl' : 'text-3xl'
            }`}
          >
            Create Offering with AI
          </h1>
          <p className={`text-[var(--muted-foreground)] ${isCompactPhase ? 'text-sm sm:text-base' : ''}`}>
            Answer a few questions and let AI generate your complete offering profile
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/partners/dashboard" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]">
              Back to Dashboard
            </Link>
          </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Phase-based rendering */}
        {phase === 'input' && (
          <InputForm onSubmit={handleInputSubmit} />
        )}

        {phase === 'processing' && (
          <ProcessingLoader stage={state.currentStage!} />
        )}

        {phase === 'clarifying' && (
          <ClarificationChat
            questions={state.clarificationNeeded || []}
            onSubmit={handleClarificationSubmit}
            onSkip={() => handleFinalize(state.sessionId!)}
            confidenceScore={state.confidenceScore}
          />
        )}

        {phase === 'complete' && (
          <SuccessMessage
            offeringId={state.offeringId!}
            slug={state.slug!}
            status={state.status!}
            confidenceScore={state.confidenceScore!}
            redirectUrl={state.redirectUrl!}
            onCreateAnother={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
