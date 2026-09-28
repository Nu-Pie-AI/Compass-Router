'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ExternalLink, Plus } from 'lucide-react';

interface SuccessMessageProps {
  offeringId: string;
  slug: string;
  status: 'published' | 'pending_review' | 'draft';
  confidenceScore: number;
  redirectUrl: string;
  onCreateAnother: () => void;
}

export function SuccessMessage({
  offeringId,
  slug,
  status,
  confidenceScore,
  redirectUrl,
  onCreateAnother,
}: SuccessMessageProps) {
  const router = useRouter();

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85) {
      return { label: 'Excellent', color: 'bg-green-100 text-green-700' };
    }
    if (score >= 70) {
      return { label: 'Good', color: 'bg-yellow-100 text-yellow-700' };
    }
    return { label: 'Fair', color: 'bg-orange-100 text-orange-700' };
  };

  const badge = getConfidenceBadge(confidenceScore);
  const canViewPublicPage = status === 'published';

  return (
    <div className="bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
      <div className="bg-green-50 p-8 text-center border-b border-green-200">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Offering Created Successfully!
        </h2>
        <p className="text-[var(--muted-foreground)]">
          Your offering has been generated and saved
        </p>
      </div>

      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              AI Confidence Score
            </p>
            <p className={`text-3xl font-bold ${getConfidenceColor(confidenceScore)}`}>
              {confidenceScore}%
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
            What Happens Next?
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-[#4DBC65]/10 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-[#4DBC65]">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Review and edit your offering
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Check the AI-generated content and make any necessary changes
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-[#4DBC65]/10 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-[#4DBC65]">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Add additional details
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Upload screenshots, update pricing, and customize further
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-[#4DBC65]/10 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-[#4DBC65]">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Publish to marketplace
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {confidenceScore >= 85
                    ? 'Your offering will be ready for team review and publishing'
                    : 'Review the content and publish when you are satisfied'}
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-[#4DBC65]/5 rounded-lg border border-[#4DBC65]/20">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-2">
            AI Generated
          </h4>
          <ul className="text-sm text-[#4DBC65] space-y-1">
            <li>Complete offering intelligence profile (37 data points)</li>
            <li>Semantic embeddings for AI-powered matching</li>
            <li>Customer profile and use cases</li>
            <li>Security and compliance details</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => router.push(redirectUrl)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors"
          >
            Review Offering
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onCreateAnother}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--background)] hover:bg-[var(--border)] text-[var(--foreground)] font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Another
          </button>
        </div>

        <div className="pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">Quick Links:</p>
          <div className="flex flex-wrap gap-2 items-center">
            {canViewPublicPage ? (
              <a
                href={`/offerings/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#4DBC65] hover:text-[#3fa656]"
              >
                View Public Page
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-xs text-[var(--muted-foreground)]">
                Public page available after publish
              </span>
            )}

            <span className="text-[var(--muted-foreground)]">•</span>

            <a
              href="/partners/dashboard"
              className="text-xs text-[#4DBC65] hover:text-[#3fa656]"
            >
              Go to Dashboard
            </a>
          </div>
        </div>

        <div className="text-xs text-[var(--muted-foreground)]">
          Offering ID: {offeringId}
        </div>
      </div>
    </div>
  );
}
