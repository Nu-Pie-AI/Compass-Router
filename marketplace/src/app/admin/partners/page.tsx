"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ExternalLink, Package, Building2 } from "lucide-react";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast-helpers";
import { DashboardHero, DashboardShell, StatusPill, ThemedLink } from "@/components/dashboard/DashboardChrome";

interface Partner {
  id: string;
  companyName: string;
  website: string | null;
  providerType: string;
  approvalStatus: string;
  status: string;
  createdAt: string;
  totalOfferings: number;
  publishedOfferings: number;
  suspensionReason?: string | null;
  rejectionReason?: string | null;
  contacts?: Array<{
    email: string;
    name: string;
    role: string;
  }>;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPartners = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/partners?status=${selectedStatus}&page=${page}`);
      const data = await response.json();

      if (response.ok) {
        setPartners(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [selectedStatus, page]);

  const handleApprove = async (partnerId: string) => {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        toastSuccess('Partner approved', 'Partner has been notified and can now submit offerings');
        fetchPartners();
      } else {
        toastError('Failed to approve partner');
      }
    } catch (error) {
      console.error('Failed to approve partner:', error);
      toastError('Failed to approve partner', 'Please try again');
    }
  };

  const handleReject = async (partnerId: string) => {
    const reason = prompt('Please provide a rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        toastSuccess('Partner rejected', 'Partner has been notified');
        fetchPartners();
      } else {
        toastError('Failed to reject partner');
      }
    } catch (error) {
      console.error('Failed to reject partner:', error);
      toastError('Failed to reject partner', 'Please try again');
    }
  };

  const openSuspendModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setSuspensionReason('');
    setSuspendModalOpen(true);
  };

  const closeSuspendModal = () => {
    setSuspendModalOpen(false);
    setSelectedPartner(null);
    setSuspensionReason('');
  };

  const handleSuspend = async () => {
    if (!selectedPartner || !suspensionReason.trim()) {
      toastWarning('Suspension reason required', 'Please explain why this partner is being suspended');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/partners/${selectedPartner.id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspensionReason }),
      });

      if (response.ok) {
        toastSuccess('Partner suspended', 'Partner has been notified');
        closeSuspendModal();
        fetchPartners();
      } else {
        toastError('Failed to suspend partner');
      }
    } catch (error) {
      console.error('Failed to suspend partner:', error);
      toastError('Failed to suspend partner', 'Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReinstate = async (partnerId: string) => {
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/reinstate`, {
        method: 'PUT',
      });

      if (response.ok) {
        toastSuccess('Partner reinstated', 'Partner status has been restored');
        fetchPartners();
      } else {
        toastError('Failed to reinstate partner');
      }
    } catch (error) {
      console.error('Failed to reinstate partner:', error);
      toastError('Failed to reinstate partner', 'Please try again');
    }
  };

  const getProviderTypeBadge = (type: string) => {
    const styles = {
      software_vendor: 'bg-blue-100 text-blue-800',
      service_provider: 'bg-purple-100 text-purple-800',
      implementation_partner: 'bg-green-100 text-green-800',
      hybrid: 'bg-indigo-100 text-indigo-800',
    }[type.toLowerCase()] || 'bg-[var(--background)] text-[var(--foreground)]';

    const label = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles}`}>
        {label}
      </span>
    );
  };

  return (
    <DashboardShell wide>
        <DashboardHero
          eyebrow="Admin partners"
          title="Partner Management"
          description="Manage partner registrations, approvals, suspensions, and offering health."
          icon={Building2}
          actions={
            <>
              <ThemedLink href="/admin" variant="secondary">Dashboard</ThemedLink>
              <ThemedLink href="/admin/partners/approve" variant="secondary">Approvals</ThemedLink>
              <ThemedLink href="/admin/partners/initiate-onboarding" variant="primary">Start Onboarding</ThemedLink>
            </>
          }
        />

        {/* Status Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'rejected', 'suspended'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setSelectedStatus(status);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)] border border-[var(--border)]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Partners Table */}
        <div className="bg-[var(--surface)] rounded-lg shadow-sm overflow-hidden border border-[var(--border)]">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
              <p className="text-[var(--muted-foreground)]">Loading partners...</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[var(--muted-foreground)]">No partners found for this status</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Offerings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {partners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-[var(--background)]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm font-medium text-[var(--foreground)]">
                              {partner.companyName}
                            </div>
                            {partner.website && (
                              <a
                                href={partner.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                              >
                                Visit website
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {partner.contacts && partner.contacts.length > 0 ? (
                          <div className="text-sm">
                            <div className="text-[var(--foreground)] font-medium">
                              {partner.contacts[0].name}
                            </div>
                            <div className="text-[var(--muted-foreground)]">
                              {partner.contacts[0].email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">No contact</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getProviderTypeBadge(partner.providerType)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-[var(--muted-foreground)]" />
                          <span className="text-sm text-[var(--foreground)]">
                            {partner.publishedOfferings}/{partner.totalOfferings}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill label={partner.approvalStatus} tone={partner.approvalStatus === 'APPROVED' ? 'success' : partner.approvalStatus === 'REJECTED' ? 'danger' : 'warning'} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {new Date(partner.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {partner.approvalStatus === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(partner.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(partner.id)}
                                className="px-3 py-1 text-xs font-medium text-[var(--error)] border border-[var(--error)] hover:bg-red-50 rounded transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {partner.approvalStatus === 'APPROVED' && partner.status !== 'suspended' && (
                            <button
                              onClick={() => openSuspendModal(partner)}
                              className="px-3 py-1 text-xs font-medium text-orange-600 border border-orange-600 hover:bg-orange-50 rounded transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                          {partner.status === 'suspended' && (
                            <button
                              onClick={() => handleReinstate(partner.id)}
                              className="px-3 py-1 text-xs font-medium text-[var(--primary)] border border-[var(--primary)] hover:bg-green-50 rounded transition-colors"
                            >
                              Reinstate
                            </button>
                          )}
                          <Link
                            href={`/admin/partners/${partner.id}`}
                            className="px-3 py-1 text-xs font-medium text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--background)] rounded transition-colors"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-[var(--muted-foreground)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      

      {/* Suspend Modal */}
      {suspendModalOpen && selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--surface)] rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--foreground)]">Suspend Partner</h3>
              <button
                onClick={closeSuspendModal}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Suspending <strong>{selectedPartner.companyName}</strong>. Please provide a reason:
            </p>

            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="e.g., Violation of terms of service, quality issues, etc."
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] mb-4"
              rows={4}
            />

            <div className="flex gap-3">
              <button
                onClick={handleSuspend}
                disabled={isProcessing || !suspensionReason.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Suspending...' : 'Confirm Suspension'}
              </button>
              <button
                onClick={closeSuspendModal}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--background)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
