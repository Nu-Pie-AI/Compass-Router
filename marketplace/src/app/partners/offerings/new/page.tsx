'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { TemplateSelector } from '@/components/ui/TemplateSelector';
import { OfferingTemplate } from '@/lib/offering-templates';
import { Sparkles } from 'lucide-react';

const offeringSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  shortDescription: z.string().min(20, 'Description must be at least 20 characters').max(500),
  description: z.string().min(50, 'Full description must be at least 50 characters'),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  // logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  logo: z.string().optional(),
  offeringType: z.enum(['PRODUCT', 'SERVICE', 'IMPLEMENTATION', 'TRAINING', 'MANAGED_SERVICE']),
  primaryFunction: z.string().min(1, 'Please select a category'),
  pricingModel: z.enum(['freemium', 'paid', 'custom', 'per-seat', 'per-usage']).optional(),
  startingPrice: z.coerce.number().min(0).optional(),
  hasFreeTrial: z.boolean().optional(),
  regions: z.array(z.string()).min(1, 'Select at least one region'),
});

type OfferingFormData = z.infer<typeof offeringSchema>;

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function NewOfferingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setValue,
  } = useForm<OfferingFormData>({
    resolver: zodResolver(offeringSchema),
    defaultValues: {
      offeringType: 'PRODUCT',
      pricingModel: 'paid',
      startingPrice: 0,
      hasFreeTrial: false,
      regions: ['North America'],
    },
  });

  useEffect(() => {
    fetchCategories();
    loadDraft();
  }, []);

  // Autosave every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const formData = watch();
      if (formData.title || formData.shortDescription || formData.description) {
        saveDraft(formData);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [watch]);

  const loadDraft = () => {
    const savedDraft = localStorage.getItem('offering-draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // Populate form with draft data
        Object.entries(draft.data).forEach(([key, value]) => {
          setValue(key as any, value);
        });
        setDraftId(draft.id);
        setLastSaved(new Date(draft.savedAt));
      } catch (err) {
        console.error('Failed to load draft:', err);
      }
    }
  };

  const saveDraft = async (data: Partial<OfferingFormData>) => {
    if (autosaving) return;

    setAutosaving(true);
    try {
      // Save to localStorage
      const draftData = {
        id: draftId || crypto.randomUUID(),
        data,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('offering-draft', JSON.stringify(draftData));
      setDraftId(draftData.id);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Autosave failed:', err);
    } finally {
      setAutosaving(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('offering-draft');
    setDraftId(null);
    setLastSaved(null);
  };

  const handleTemplateSelect = (template: OfferingTemplate) => {
    // Populate form with template data
    setValue('offeringType', template.data.offeringType);
    setValue('primaryFunction', template.data.primaryFunction);
    if (template.data.pricingModel) setValue('pricingModel', template.data.pricingModel);
    if (template.data.hasFreeTrial !== undefined) setValue('hasFreeTrial', template.data.hasFreeTrial);
    setValue('regions', template.data.regions);
    if (template.data.shortDescription) setValue('shortDescription', template.data.shortDescription);
    if (template.data.description) setValue('description', template.data.description);

    setShowTemplates(false);
  };

  // const fetchCategories = async () => {
  //   try {
  //     const response = await fetch('/api/categories');
  //     const data = await response.json();
  //     if (data.success && data.data) {
  //       setCategories(data.data);
  //     }
  //   } catch (err) {
  //     console.error('Failed to fetch categories:', err);
  //   }
  // };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();

      console.log('API categories response:', data);

      if (Array.isArray(data)) {
        setCategories(data);
      } else if (data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const onSubmit = async (data: OfferingFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partners/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log("SERVER ERROR:", errorData);
        throw new Error(errorData.message || 'Failed to create offering');
      }

      const result = await response.json();

      // Clear draft on successful submission
      clearDraft();

      // Redirect to review page
      router.push(`/partners/offerings/review/${result.offering.id}`);
    } catch (err: any) {
      console.error('Create offering error:', err);
      setError(err.message || 'Failed to create offering');
    } finally {
      setLoading(false);
    }
  };

  const offeringType = watch('offeringType');
  const pricingModel = watch('pricingModel');

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Create New Offering</h1>
              <p className="text-[var(--muted-foreground)]">Add a new product or service to your partner profile</p>
            </div>
            {/* Autosave Status */}
            <div className="text-sm text-[var(--muted-foreground)]">
              {autosaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving draft...</span>
                </div>
              ) : lastSaved ? (
                <span>Draft saved {new Date(lastSaved).toLocaleTimeString()}</span>
              ) : null}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Template Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Use a Template
          </button>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Save time by starting with a pre-filled form for common offering types
          </p>
        </div>

        {/* Form */}
        {/* <form onSubmit={handleSubmit(onSubmit)} className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-[var(--border)]"> */}
        <form
          onSubmit={handleSubmit(
            onSubmit,
            (errors) => {
              console.log("Validation errors:", errors);
            }
          )}
        >
          {/* Basic Information */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Basic Information</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Offering Title <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('title')}
                  type="text"
                  placeholder="e.g., Acme CRM Pro"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
                )}
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Short Description <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('shortDescription')}
                  type="text"
                  placeholder="Brief one-line description (max 500 characters)"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={500}
                />
                {errors.shortDescription && (
                  <p className="text-red-500 text-sm mt-1">{errors.shortDescription.message}</p>
                )}
              </div>

              {/* Full Description */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Full Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('description')}
                  rows={6}
                  placeholder="Detailed description of your offering, key features, benefits..."
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                )}
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Website URL
                </label>
                <input
                  {...register('website')}
                  type="url"
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.website && (
                  <p className="text-red-500 text-sm mt-1">{errors.website.message}</p>
                )}
              </div>

              {/* Logo Upload */}
              <div>
                <Controller
                  name="logo"
                  control={control}
                  render={({ field }) => (
                    <ImageUpload
                      value={field.value}
                      onChange={field.onChange}
                      label="Logo"
                      error={errors.logo?.message}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Classification</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Offering Type */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Offering Type <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('offeringType')}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PRODUCT">Product (Software/SaaS)</option>
                  <option value="SERVICE">Service (Consulting)</option>
                  <option value="IMPLEMENTATION">Implementation</option>
                  <option value="TRAINING">Training</option>
                  <option value="MANAGED_SERVICE">Managed Service</option>
                </select>
                {errors.offeringType && (
                  <p className="text-red-500 text-sm mt-1">{errors.offeringType.message}</p>
                )}
              </div>

              {/* Primary Function/Category */}
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                  Primary Category <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('primaryFunction')}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.primaryFunction && (
                  <p className="text-red-500 text-sm mt-1">{errors.primaryFunction.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Pricing</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pricing Model */}
                <div>
                  <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                    Pricing Model
                  </label>
                  <select
                    {...register('pricingModel')}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="freemium">Freemium</option>
                    <option value="paid">Paid</option>
                    <option value="custom">Custom Pricing</option>
                    <option value="per-seat">Per Seat</option>
                    <option value="per-usage">Per Usage</option>
                  </select>
                </div>

                {/* Starting Price */}
                {pricingModel !== 'freemium' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
                      Starting Price ($/month)
                    </label>
                    <input
                      {...register('startingPrice')}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Free Trial */}
              <div className="flex items-center gap-2">
                <input
                  {...register('hasFreeTrial')}
                  type="checkbox"
                  id="hasFreeTrial"
                  className="w-4 h-4 text-blue-600 border-[var(--border)] rounded focus:ring-blue-500"
                />
                <label htmlFor="hasFreeTrial" className="text-sm font-medium text-[var(--muted-foreground)]">
                  Offers free trial
                </label>
              </div>
            </div>
          </div>

          {/* Regions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
              Availability <span className="text-red-500">*</span>
            </h2>

            <div className="space-y-2">
              {['North America', 'Europe', 'Asia-Pacific', 'Latin America', 'Middle East & Africa', 'Global'].map((region) => (
                <div key={region} className="flex items-center gap-2">
                  <input
                    {...register('regions')}
                    type="checkbox"
                    id={`region-${region}`}
                    value={region}
                    className="w-4 h-4 text-blue-600 border-[var(--border)] rounded focus:ring-blue-500"
                  />
                  <label htmlFor={`region-${region}`} className="text-sm font-medium text-[var(--muted-foreground)]">
                    {region}
                  </label>
                </div>
              ))}
            </div>
            {errors.regions && (
              <p className="text-red-500 text-sm mt-1">{errors.regions.message}</p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 text-[var(--muted-foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Offering'}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> After creating your offering, you can add more details like use cases,
            integrations, pain points, and customer testimonials in the review step.
          </p>
        </div>

        {/* Template Selector Modal */}
        {showTemplates && (
          <TemplateSelector
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
          />
        )}
      </div>
    </div>
  );
}
