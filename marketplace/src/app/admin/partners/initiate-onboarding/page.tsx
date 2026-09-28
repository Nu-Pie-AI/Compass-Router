'use client';

// ============================================
// ADMIN: Initiate Partner Onboarding
// ============================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { DashboardHero, DashboardShell, ThemedLink } from '@/components/dashboard/DashboardChrome';

interface NotOnboardedPartner {
  id: string;
  companyName: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  providerType: string;
}

export default function AdminInitiateOnboardingPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<NotOnboardedPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotOnboardedPartners();
  }, []);

  const fetchNotOnboardedPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/partners/not-onboarded');

      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }

      const data = await response.json();
      setPartners(data.partners);
    } catch (err: unknown) {
      console.error('Error fetching partners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = () => {
    if (!selectedPartnerId) {
      setError('Please select a partner');
      return;
    }

    // Navigate to onboarding page with partnerId
    router.push(`/partners/onboard?partnerId=${selectedPartnerId}`);
  };

  return (
    <DashboardShell>
        <DashboardHero
          eyebrow="Admin onboarding"
          title="Initiate Partner Onboarding"
          description="Select a partner and start their AI onboarding process from the admin side."
          icon={UserPlus}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/partners" variant="secondary">Partners</ThemedLink>
            </>
          }
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)] text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-[var(--muted-foreground)]">Loading partners...</p>
          </div>
        )}

        {/* No Partners State */}
        {!loading && partners.length === 0 && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)] text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">All Caught Up!</h2>
            <p className="text-[var(--muted-foreground)]">
              There are no partners pending onboarding at this time.
            </p>
            <button
              onClick={() => router.push('/admin/partners')}
              className="mt-6 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Back to Partners
            </button>
          </div>
        )}

        {/* Partner Selection */}
        {!loading && partners.length > 0 && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)]">
            <div className="mb-6">
              <label htmlFor="partner-select" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Select Partner to Onboard
              </label>
              <select
                id="partner-select"
                value={selectedPartnerId}
                onChange={(e) => {
                  setSelectedPartnerId(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--surface)] text-[var(--foreground)]"
              >
                <option value="">-- Choose a partner --</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.companyName} - {partner.userName} ({partner.userEmail}) - {partner.providerType}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {partners.length} partner{partners.length !== 1 ? 's' : ''} pending onboarding
              </p>
            </div>

            {/* Selected Partner Details */}
            {selectedPartnerId && (
              <div className="mb-6 p-4 bg-[var(--secondary)]/10 rounded-lg border border-[var(--secondary)]/20">
                {(() => {
                  const selected = partners.find((p) => p.id === selectedPartnerId);
                  if (!selected) return null;

                  return (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-[var(--foreground)]">Selected Partner Details:</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-[var(--muted-foreground)]">Company:</span>
                          <span className="ml-2 text-[var(--foreground)]">{selected.companyName}</span>
                        </div>
                        <div>
                          <span className="font-medium text-[var(--muted-foreground)]">Type:</span>
                          <span className="ml-2 text-[var(--foreground)]">{selected.providerType.replace('_', ' ')}</span>
                        </div>
                        <div>
                          <span className="font-medium text-[var(--muted-foreground)]">User:</span>
                          <span className="ml-2 text-[var(--foreground)]">{selected.userName}</span>
                        </div>
                        <div>
                          <span className="font-medium text-[var(--muted-foreground)]">Email:</span>
                          <span className="ml-2 text-[var(--foreground)]">{selected.userEmail}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-[var(--muted-foreground)]">Created:</span>
                          <span className="ml-2 text-[var(--foreground)]">
                            {new Date(selected.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleStartOnboarding}
                disabled={!selectedPartnerId}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Onboarding for Selected Partner
              </button>
              <button
                onClick={() => router.push('/admin/partners')}
                className="flex-1 bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-[var(--background)] rounded-lg">
              <h3 className="font-semibold text-[var(--foreground)] mb-2">Admin Onboarding Process:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--muted-foreground)]">
                <li>Select a partner from the dropdown above</li>
                <li>Click Start Onboarding to begin the AI extraction process</li>
                <li>Enter the partner website URL and let AI extract data</li>
                <li>Review and approve the AI-generated information</li>
                <li>The partner profile and offerings will be created</li>
              </ol>
              <p className="mt-3 text-sm text-[var(--muted-foreground)] italic">
                Note: The system will track that this was an admin-initiated onboarding in the audit trail.
              </p>
            </div>
          </div>
        )}
    </DashboardShell>
  );
}
