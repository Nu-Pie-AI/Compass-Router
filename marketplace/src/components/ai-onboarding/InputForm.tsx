'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Link as LinkIcon, Sparkles } from 'lucide-react';

const inputFormSchema = z.object({
  offeringName: z.string().min(3, 'Name must be at least 3 characters'),
  offeringSummary: z.string().min(60, 'Summary must be at least 60 words').max(500, 'Summary must be less than 500 characters'),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  allowWebBrowsing: z.enum(['yes', 'no', 'not-sure']),
  uploadedFileUrls: z.array(z.string()).optional(),
});

type InputFormData = z.infer<typeof inputFormSchema>;

interface InputFormProps {
  onSubmit: (data: InputFormData) => void;
}

export function InputForm({ onSubmit }: InputFormProps) {
  const [wordCount, setWordCount] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<InputFormData>({
    resolver: zodResolver(inputFormSchema),
    defaultValues: {
      allowWebBrowsing: 'not-sure',
      uploadedFileUrls: [],
    },
  });

  // Count words in summary
  const summary = watch('offeringSummary');
  const updateWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Tell Us About Your Offering
        </h2>

        {/* Input 1: Offering Name */}
        <div className="mb-6">
          <label htmlFor="offeringName" className="block text-sm font-medium text-[var(--foreground)] mb-2">
            1. Offering Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="offeringName"
            {...register('offeringName')}
            placeholder="e.g., SmartCRM Pro"
            className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)]"
          />
          {errors.offeringName && (
            <p className="mt-1 text-sm text-red-600">{errors.offeringName.message}</p>
          )}
        </div>

        {/* Input 2: Summary */}
        <div className="mb-6">
          <label htmlFor="offeringSummary" className="block text-sm font-medium text-[var(--foreground)] mb-2">
            2. Short Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            id="offeringSummary"
            {...register('offeringSummary')}
            onChange={(e) => {
              register('offeringSummary').onChange(e);
              updateWordCount(e.target.value);
            }}
            rows={4}
            placeholder="Describe what your offering does, who it's for, and what problems it solves. Include key features, pricing, and compliance if relevant."
            className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)]"
          />
          <div className="mt-1 flex justify-between">
            <div>
              {errors.offeringSummary && (
                <p className="text-sm text-red-600">{errors.offeringSummary.message}</p>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {wordCount} words ({summary?.length || 0}/500 characters)
            </p>
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            💡 Tip: Include features, pricing, integrations, and compliance to help AI generate better results
          </p>
        </div>

        {/* Input 3: Website URL (Optional) */}
        <div className="mb-6">
          <label htmlFor="websiteUrl" className="block text-sm font-medium text-[var(--foreground)] mb-2">
            3. Website or Product Page (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LinkIcon className="h-5 w-5 text-[var(--muted-foreground)]" />
            </div>
            <input
              type="url"
              id="websiteUrl"
              {...register('websiteUrl')}
              placeholder="https://example.com"
              className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)]"
            />
          </div>
          {errors.websiteUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.websiteUrl.message}</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            We&apos;ll extract additional information from your website to enrich the offering
          </p>
        </div>

        {/* Input 4: File Upload (Optional) - Placeholder */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            4. Upload Documents (Optional)
          </label>
          <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center bg-[var(--background)]">
            <Upload className="mx-auto h-12 w-12 text-[var(--muted-foreground)]" />
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              File upload coming soon
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              PDF, DOC, or TXT files (max 10MB)
            </p>
          </div>
        </div>

        {/* Input 5: Allow Web Browsing */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
            5. Allow AI to Browse Your Website? <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--background)] transition-colors">
              <input
                type="radio"
                {...register('allowWebBrowsing')}
                value="yes"
                className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
              />
              <span className="ml-3 text-sm text-[var(--foreground)]">
                Yes, browse freely to extract information
              </span>
            </label>
            <label className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--background)] transition-colors">
              <input
                type="radio"
                {...register('allowWebBrowsing')}
                value="no"
                className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
              />
              <span className="ml-3 text-sm text-[var(--foreground)]">
                No, use only the information I provided
              </span>
            </label>
            <label className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--background)] transition-colors">
              <input
                type="radio"
                {...register('allowWebBrowsing')}
                value="not-sure"
                className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
              />
              <span className="ml-3 text-sm text-[var(--foreground)]">
                Not sure, you decide
              </span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            ⚡ Takes ~1-2 minutes
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Start AI Onboarding
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
