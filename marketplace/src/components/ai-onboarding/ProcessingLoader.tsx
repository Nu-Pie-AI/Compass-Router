'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

type ProcessingStage = 'extracting' | 'generating' | 'finalizing';

interface ProcessingLoaderProps {
  stage: ProcessingStage;
}

interface Stage {
  id: ProcessingStage;
  title: string;
  description: string;
  estimatedTime: string;
}

const stages: Stage[] = [
  {
    id: 'extracting',
    title: 'Extracting Context',
    description: 'Analyzing website and documents to extract key information',
    estimatedTime: '10-15s',
  },
  {
    id: 'generating',
    title: 'Generating Intelligence',
    description: 'Creating your offering profile with AI',
    estimatedTime: '30-40s',
  },
  {
    id: 'finalizing',
    title: 'Creating Offering',
    description: 'Saving to the database and generating embeddings',
    estimatedTime: '5-10s',
  },
];

export function ProcessingLoader({ stage }: ProcessingLoaderProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const currentStageIndex = stages.findIndex((entry) => entry.id === stage);

  return (
    <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] p-5 sm:p-6">
      <div className="text-center mb-5 sm:mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-[#4DBC65]/10 rounded-full mb-3">
          <Loader2 className="w-6 h-6 text-[#4DBC65] animate-spin" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-1.5">
          AI is Working{dots}
        </h2>
        <p className="text-sm sm:text-base text-[var(--muted-foreground)]">
          This usually takes under a minute. Please keep this tab open.
        </p>
      </div>

      <div className="space-y-3 max-w-2xl mx-auto">
        {stages.map((stageInfo, index) => {
          const isComplete = index < currentStageIndex;
          const isActive = index === currentStageIndex;

          return (
            <div
              key={stageInfo.id}
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border transition-all ${
                isActive
                  ? 'border-[#4DBC65]/20 bg-[#4DBC65]/5'
                  : isComplete
                    ? 'border-green-200 bg-green-50'
                    : 'border-[var(--border)] bg-[var(--background)]'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : isActive ? (
                  <div className="relative">
                    <Circle className="w-5 h-5 text-[#4DBC65]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#4DBC65] rounded-full animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-[var(--muted-foreground)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h3
                    className={`text-sm sm:text-base font-semibold ${
                      isActive
                        ? 'text-[var(--foreground)]'
                        : isComplete
                          ? 'text-green-900'
                          : 'text-[var(--muted-foreground)]'
                    }`}
                  >
                    {stageInfo.title}
                  </h3>
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      isActive ? 'text-[#4DBC65]' : 'text-[var(--muted-foreground)]'
                    }`}
                  >
                    {isActive ? `~${stageInfo.estimatedTime}` : isComplete ? 'Done' : ''}
                  </span>
                </div>

                <p
                  className={`text-xs sm:text-sm leading-5 ${
                    isActive
                      ? 'text-[var(--muted-foreground)]'
                      : isComplete
                        ? 'text-green-700'
                        : 'text-[var(--muted-foreground)]'
                  }`}
                >
                  {stageInfo.description}
                </p>

                {isActive && (
                  <div className="mt-2.5 h-1 bg-[#4DBC65]/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4DBC65] rounded-full animate-[progress_2s_ease-in-out_infinite]"
                      style={{ width: '60%' }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Our AI is analyzing your offering and generating a complete intelligence profile.
        </p>
      </div>
    </div>
  );
}
