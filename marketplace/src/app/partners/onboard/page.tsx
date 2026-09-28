'use client';

// ============================================
// PARTNER ONBOARDING - AI-FIRST
// ============================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface OfferingSummary {
  id: string;
  slug: string;
  title: string;
  confidenceScore: number;
  status: string;
}

export default function PartnerOnboardPage() {
  const router = useRouter();
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'validating' | 'input' | 'extracting' | 'creating' | 'success' | 'error'>('validating');
  const [error, setError] = useState('');
  const [partner, setPartner] = useState<any>(null);
  const [offerings, setOfferings] = useState<OfferingSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [accessValidated, setAccessValidated] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);

  // Get partnerId from query params (for admin-initiated onboarding)
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const partnerId = searchParams.get('partnerId');

  // Validate access on mount
  useEffect(() => {
    validateAccess();
  }, []);

  const validateAccess = async () => {
    try {
      setPhase('validating');
      const response = await fetch('/api/partners/onboard/validate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      });

      const data = await response.json();

      if (!data.allowed) {
        // Access denied - redirect to appropriate page
        console.error('Access denied:', data.reason);
        setError(data.reason);
        setTimeout(() => {
          router.push(data.redirectTo);
        }, 2000);
        return;
      }

      // Access granted
      setAccessValidated(true);
      setPartnerInfo(data.partnerRecord);
      setPhase('input');
    } catch (err: any) {
      console.error('Access validation error:', err);
      setError('Failed to validate access. Redirecting...');
      setPhase('error');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPhase('extracting');

    try {
      // Step 1: Scrape and extract
      const extractResponse = await fetch('/api/partners/onboard/scrape-and-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website,
          partnerId: partnerId || undefined, // Pass partnerId for admin-initiated onboarding
        }),
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.message || 'Failed to extract data');
      }

      const extractData = await extractResponse.json();
      setPartner(extractData.partner);

      // Step 2: Create partner and offerings
      setPhase('creating');
      const createResponse = await fetch('/api/partners/onboard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner: extractData.partner,
          offerings: extractData.offerings,
          partnerId: partnerId || undefined, // For admin-initiated onboarding
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create partner');
      }

      const createData = await createResponse.json();
      setOfferings(createData.offerings);
      setSummary(createData.summary);
      setPhase('success');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'An error occurred during onboarding');
      setPhase('error');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 85) return 'High Confidence';
    if (score >= 60) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-3">
            Partner Onboarding
          </h1>
          <p className="text-xl text-[var(--muted-foreground)]">
            Enter your website URL and our AI will extract your company and product information
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            <span className="text-2xl">✨</span>
            <span className="font-medium">AI-Powered Extraction in Seconds</span>
          </div>
        </div>

        {/* Admin-Initiated Onboarding Banner */}
        {partnerId && partnerInfo && accessValidated && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">👤</span>
              <h2 className="text-xl font-bold text-orange-900">Admin-Initiated Onboarding</h2>
            </div>
            <p className="text-orange-700">
              You are onboarding partner: <span className="font-semibold">{partnerInfo.companyName || 'New Partner'}</span>
            </p>
            <p className="text-orange-600 text-sm mt-1">
              This onboarding will be tracked as admin-initiated in the system.
            </p>
          </div>
        )}

        {/* Validating Access Phase */}
        {phase === 'validating' && (
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-[var(--border)] text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Validating Access...</h2>
            <p className="text-[var(--muted-foreground)]">
              Checking permissions and onboarding status...
            </p>
          </div>
        )}

        {/* Input Phase */}
        {phase === 'input' && accessValidated && (
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-[var(--border)]">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="website" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Company Website URL
                </label>
                <input
                  type="text"
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://your-company.com"
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Our AI will analyze your website and extract information about your company and products/services
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Start AI Extraction'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-[var(--background)] rounded-lg">
              <h3 className="font-semibold text-[var(--foreground)] mb-2">What happens next?</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--muted-foreground)]">
                <li>AI scrapes and analyzes your website (~30 seconds)</li>
                <li>Extracts company profile and product/service offerings</li>
                <li>You review and approve the AI-generated data</li>
                <li>Your offerings go live on the marketplace!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Extracting Phase */}
        {phase === 'extracting' && (
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-[var(--border)] text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Analyzing Your Website...</h2>
            <p className="text-[var(--muted-foreground)]">
              Our AI is scraping and extracting structured data from your website. This usually takes 20-40 seconds.
            </p>
          </div>
        )}

        {/* Creating Phase */}
        {phase === 'creating' && (
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-[var(--border)] text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Creating Your Partner Profile...</h2>
            <p className="text-[var(--muted-foreground)]">
              Saving your company and offerings to the marketplace...
            </p>
          </div>
        )}

        {/* Success Phase */}
        {phase === 'success' && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-3xl font-bold text-green-900 mb-2">Success!</h2>
              <p className="text-lg text-green-700">
                Your partner profile and {summary?.total || 0} offering(s) have been created
              </p>
            </div>

            {/* Partner Info */}
            {partner && (
              <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)] mb-4">Partner Profile</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-[var(--muted-foreground)]">Company:</span>
                    <span className="ml-2 text-[var(--foreground)]">{partner.companyName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--muted-foreground)]">Type:</span>
                    <span className="ml-2 text-[var(--foreground)]">{partner.providerType.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--muted-foreground)]">Industry:</span>
                    <span className="ml-2 text-[var(--foreground)]">{partner.industry}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--muted-foreground)]">Size:</span>
                    <span className="ml-2 text-[var(--foreground)]">{partner.companySize}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="font-medium text-[var(--muted-foreground)]">Description:</span>
                  <p className="text-[var(--foreground)] mt-1">{partner.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-medium text-[var(--muted-foreground)]">AI Confidence:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(partner.confidenceScore)}`}>
                    {partner.confidenceScore}% - {getConfidenceLabel(partner.confidenceScore)}
                  </span>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {summary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-3xl font-bold text-green-700">{summary.highConfidence}</div>
                  <div className="text-sm text-green-600">High Confidence (85%+)</div>
                  <div className="text-xs text-green-500 mt-1">Ready to publish</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-700">{summary.mediumConfidence}</div>
                  <div className="text-sm text-yellow-600">Medium (60-84%)</div>
                  <div className="text-xs text-yellow-500 mt-1">Review recommended</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="text-3xl font-bold text-red-700">{summary.lowConfidence}</div>
                  <div className="text-sm text-red-600">Low (&lt;60%)</div>
                  <div className="text-xs text-red-500 mt-1">Needs editing</div>
                </div>
              </div>
            )}

            {/* Offerings List */}
            <div className="bg-[var(--surface)] rounded-xl shadow-md p-6 border border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--foreground)] mb-4">Extracted Offerings</h3>
              <div className="space-y-3">
                {offerings.map((offering) => (
                  <div
                    key={offering.id}
                    className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition"
                  >
                    <div>
                      <h4 className="font-semibold text-[var(--foreground)]">{offering.title}</h4>
                      <p className="text-sm text-[var(--muted-foreground)]">Slug: {offering.slug}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getConfidenceColor(offering.confidenceScore)}`}>
                      {offering.confidenceScore}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/partners/dashboard')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Partner Dashboard
              </button>
              <button
                onClick={() => {
                  setPhase('input');
                  setWebsite('');
                  setPartner(null);
                  setOfferings([]);
                  setSummary(null);
                }}
                className="flex-1 bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Start Another Onboarding
              </button>
            </div>
          </div>
        )}

        {/* Error Phase */}
        {phase === 'error' && (
          <div className="bg-[var(--surface)] rounded-xl shadow-md p-8 border border-red-200">
            <div className="text-center">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-2xl font-bold text-red-900 mb-2">Something Went Wrong</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={() => {
                  setPhase('input');
                  setError('');
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
