'use client';

// ============================================
// ADMIN: Partner Approval Page
// ============================================

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Building2, Mail, Calendar, Loader2 } from 'lucide-react';
import { DashboardHero, DashboardShell, ThemedLink } from '@/components/dashboard/DashboardChrome';

interface PendingPartner {
  id: string;
  companyName: string | null;
  userName: string;
  userEmail: string;
  createdAt: string;
  providerType: string;
}

export default function AdminPartnerApprovePage() {
  const [partners, setPartners] = useState<PendingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingPartners();
  }, []);

  const fetchPendingPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/partners/pending');

      if (!response.ok) {
        throw new Error('Failed to fetch pending partners');
      }

      const data = await response.json();
      setPartners(data.partners);
    } catch (err: unknown) {
      console.error('Error fetching partners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending partners');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (partnerId: string) => {
    setActionLoading(partnerId);
    setError('');

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve partner');
      }

      // Remove from list
      setPartners(partners.filter((p) => p.id !== partnerId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve partner');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (partnerId: string) => {
    if (!rejectionReason[partnerId]?.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setActionLoading(partnerId);
    setError('');

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason[partnerId] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject partner');
      }

      // Remove from list
      setPartners(partners.filter((p) => p.id !== partnerId));
      setShowRejectModal(null);
      setRejectionReason((prev) => {
        const updated = { ...prev };
        delete updated[partnerId];
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject partner');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Admin partners"
          title="Partner Approvals"
          description="Review and approve partner registration requests."
          icon={Building2}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/partners" variant="secondary">Partner Management</ThemedLink>
            </>
          }
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-12 border border-[var(--border)] text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[var(--primary)]" />
            <p className="text-[var(--muted-foreground)]">Loading pending partners...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && partners.length === 0 && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-12 border border-[var(--border)] text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">All Caught Up!</h2>
            <p className="text-[var(--muted-foreground)]">
              There are no pending partner approvals at this time.
            </p>
          </div>
        )}

        {/* Partner List */}
        {!loading && partners.length > 0 && (
          <div className="space-y-4">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="bg-[var(--surface)] rounded-lg shadow-sm p-6 border border-[var(--border)] hover:shadow-ambient transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Partner Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--secondary)]/10 border border-[var(--secondary)]/20 rounded-lg">
                        <Building2 className="w-5 h-5 text-[var(--secondary)]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">
                          {partner.companyName || 'Company Name Pending'}
                        </h3>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {partner.providerType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <Mail className="w-4 h-4" />
                        <span>{partner.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <span className="font-medium">Contact:</span>
                        <span>{partner.userName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(partner.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 lg:min-w-[300px]">
                    <button
                      onClick={() => handleApprove(partner.id)}
                      disabled={actionLoading === partner.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === partner.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => setShowRejectModal(partner.id)}
                      disabled={actionLoading === partner.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {/* Reject Modal */}
                {showRejectModal === partner.id && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold text-red-900 mb-2">Rejection Reason</h4>
                    <textarea
                      value={rejectionReason[partner.id] || ''}
                      onChange={(e) =>
                        setRejectionReason((prev) => ({
                          ...prev,
                          [partner.id]: e.target.value,
                        }))
                      }
                      placeholder="Please provide a reason for rejecting this partner application..."
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleReject(partner.id)}
                        disabled={
                          !rejectionReason[partner.id]?.trim() || actionLoading === partner.id
                        }
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === partner.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Confirm Rejection'
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectModal(null);
                          setRejectionReason((prev) => {
                            const updated = { ...prev };
                            delete updated[partner.id];
                            return updated;
                          });
                        }}
                        disabled={actionLoading === partner.id}
                        className="px-4 py-2 bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        {!loading && partners.length > 0 && (
          <div className="mt-8 bg-[var(--secondary)]/10 border border-[var(--secondary)]/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[var(--secondary)] mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-2">Approval Guidelines</h3>
                <ul className="text-sm text-[var(--muted-foreground)] space-y-1">
                  <li>• Review company name and email domain for legitimacy</li>
                  <li>• Approved partners can immediately start onboarding their offerings</li>
                  <li>• Rejected partners will be notified and can contact support</li>
                  <li>• All actions are logged for audit purposes</li>
                </ul>
              </div>
            </div>
          </div>
        )}
    </DashboardShell>
  );
}
