'use client';

// ============================================
// INDIVIDUAL OFFERING REVIEW & EDIT
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

interface OfferingData {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  offeringType: string;
  primaryFunction: string;
  subCategory: string;
  useCases: string[];
  painPointsSolved: string[];
  integrations: string[];
  complianceFlags: string[];
  learningCurve: string;
  implementationTime: string;
  icpTeamSize: string;
  icpIndustry: string[];
  icpCompanyStage: string;
  icpBudget: string;
  regions: string[];
  pricingModel: string;
  startingPrice: number | null;
  hasFreeTrial: boolean;
  confidenceScore: number | null;
  status: string;
}

function inferCurrencyCode(
  budget?: string,
  regions?: string[],
  description?: string
): string {
  const combined = [budget || '', description || '', ...(regions || [])]
    .join(' ')
    .toLowerCase();

  if (combined.includes('inr') || combined.includes('india') || combined.includes('₹')) {
    return 'INR';
  }
  if (combined.includes('eur') || combined.includes('europe') || combined.includes('germany')) {
    return 'EUR';
  }
  if (combined.includes('gbp') || combined.includes('united kingdom') || combined.includes('uk')) {
    return 'GBP';
  }
  if (combined.includes('aed') || combined.includes('uae') || combined.includes('dubai')) {
    return 'AED';
  }

  return 'USD';
}

export default function OfferingReviewPage() {
  const router = useRouter();
  const params = useParams();
  const offeringId = params.id as string;

  const [offering, setOffering] = useState<OfferingData | null>(null);
  const [formData, setFormData] = useState<Partial<OfferingData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pricingCurrencyCode = inferCurrencyCode(
    formData.icpBudget,
    formData.regions,
    formData.shortDescription
  );

  const loadOffering = useCallback(async () => {
    try {
      const response = await fetch(`/api/partners/offerings/${offeringId}`);
      if (response.ok) {
        const data = await response.json();
        setOffering(data);
        setFormData(data);
      }
    } catch (error) {
      console.error('Failed to load offering:', error);
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/partners/offerings/${offeringId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toastSuccess('Offering updated successfully!', 'Your changes have been saved');
        loadOffering();
      }
    } catch (error) {
      console.error('Failed to save offering:', error);
      toastError('Failed to save changes', 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/partners/offerings/${offeringId}/publish`, {
        method: 'POST',
      });

      if (response.ok) {
        toastSuccess('Offering published successfully!', 'Your offering is now live');
        router.push('/partners/dashboard');
      }
    } catch (error) {
      console.error('Failed to publish offering:', error);
      toastError('Failed to publish', 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof OfferingData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'border-green-500 bg-green-50';
    if (score >= 60) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 85)
      return <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">✓ High Confidence</span>;
    if (score >= 60)
      return <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">⚠ Review Recommended</span>;
    return <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">✗ Needs Editing</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!offering) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">Offering Not Found</h2>
          <Link href="/partners/offerings/review" className="text-blue-600 hover:underline">
            Back to Review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Review Offering</h1>
              <p className="text-[var(--muted-foreground)]">Edit AI-generated fields and publish when ready</p>
            </div>
            <Link
              href="/partners/offerings/review"
              className="bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>

          {/* Overall Confidence */}
          {offering.confidenceScore && (
            <div className={`p-4 rounded-lg border-2 ${getConfidenceColor(offering.confidenceScore)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--muted-foreground)]">Overall AI Confidence</div>
                  <div className="text-3xl font-bold text-[var(--foreground)]">{offering.confidenceScore}%</div>
                </div>
                {getConfidenceBadge(offering.confidenceScore)}
              </div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Short Description</label>
                <textarea
                  value={formData.shortDescription || ''}
                  onChange={(e) => updateField('shortDescription', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Full Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Offering Type</label>
                  <select
                    value={formData.offeringType || ''}
                    onChange={(e) => updateField('offeringType', e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                    <option value="IMPLEMENTATION">Implementation</option>
                    <option value="TRAINING">Training</option>
                    <option value="MANAGED_SERVICE">Managed Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Primary Function</label>
                  <input
                    type="text"
                    value={formData.primaryFunction || ''}
                    onChange={(e) => updateField('primaryFunction', e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., crm, accounting, marketing"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Use Cases & Pain Points */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Use Cases & Pain Points</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Use Cases (one per line)
                </label>
                <textarea
                  value={formData.useCases?.join('\n') || ''}
                  onChange={(e) => updateField('useCases', e.target.value.split('\n').filter((s) => s.trim()))}
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Lead tracking&#10;Sales pipeline management&#10;Customer communication"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Pain Points Solved (one per line)
                </label>
                <textarea
                  value={formData.painPointsSolved?.join('\n') || ''}
                  onChange={(e) =>
                    updateField('painPointsSolved', e.target.value.split('\n').filter((s) => s.trim()))
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Manual lead entry&#10;Lost opportunities&#10;Disorganized data"
                />
              </div>
            </div>
          </div>

          {/* Integrations & Compliance */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Integrations & Compliance</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Integrations (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.integrations?.join(', ') || ''}
                  onChange={(e) =>
                    updateField(
                      'integrations',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Salesforce, Gmail, Slack, Zapier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Compliance Flags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.complianceFlags?.join(', ') || ''}
                  onChange={(e) =>
                    updateField(
                      'complianceFlags',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="GDPR, SOC2, HIPAA"
                />
              </div>
            </div>
          </div>

          {/* Ideal Customer Profile */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Ideal Customer Profile</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Team Size</label>
                <input
                  type="text"
                  value={formData.icpTeamSize || ''}
                  onChange={(e) => updateField('icpTeamSize', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 6-20 people"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Company Stage</label>
                <input
                  type="text"
                  value={formData.icpCompanyStage || ''}
                  onChange={(e) => updateField('icpCompanyStage', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Seed/Early stage"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Budget ({pricingCurrencyCode})
                </label>
                <input
                  type="text"
                  value={formData.icpBudget || ''}
                  onChange={(e) => updateField('icpBudget', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    pricingCurrencyCode === 'INR'
                      ? 'e.g., INR 5,000-15,000/month'
                      : `e.g., ${pricingCurrencyCode} 50-200/month`
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Industries (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.icpIndustry?.join(', ') || ''}
                  onChange={(e) =>
                    updateField(
                      'icpIndustry',
                      e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Technology, SaaS, Consulting"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Pricing</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Pricing Model</label>
                <select
                  value={formData.pricingModel || ''}
                  onChange={(e) => updateField('pricingModel', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="freemium">Freemium</option>
                  <option value="paid">Paid</option>
                  <option value="custom">Custom</option>
                  <option value="per-seat">Per Seat</option>
                  <option value="per-usage">Per Usage</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Starting Price ({pricingCurrencyCode})
                </label>
                <input
                  type="number"
                  value={formData.startingPrice || ''}
                  onChange={(e) => updateField('startingPrice', parseFloat(e.target.value) || null)}
                  step="0.01"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Free Trial?</label>
                <select
                  value={formData.hasFreeTrial ? 'true' : 'false'}
                  onChange={(e) => updateField('hasFreeTrial', e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Implementation */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Implementation</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Learning Curve</label>
                <select
                  value={formData.learningCurve || ''}
                  onChange={(e) => updateField('learningCurve', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Implementation Time</label>
                <select
                  value={formData.implementationTime || ''}
                  onChange={(e) => updateField('implementationTime', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="1 day">1 day</option>
                  <option value="1 week">1 week</option>
                  <option value="1 month">1 month</option>
                  <option value="3+ months">3+ months</option>
                </select>
              </div>
            </div>
          </div>

          {/* Regions */}
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Regions</h2>

            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Supported Regions (comma-separated)
              </label>
              <input
                type="text"
                value={formData.regions?.join(', ') || ''}
                onChange={(e) =>
                  updateField(
                    'regions',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="North America, Europe, Asia-Pacific"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving || offering.status === 'published'}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Publishing...' : offering.status === 'published' ? 'Already Published' : 'Save & Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
