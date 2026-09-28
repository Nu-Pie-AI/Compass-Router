"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast-helpers";

interface Vendor {
  id: string;
  companyName: string;
  website: string | null;
  contactEmail: string;
  status: string;
  createdAt: string;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  user: {
    email: string;
    name: string;
  };
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/vendors?status=${selectedStatus}&page=${page}`);
      const data = await response.json();

      if (response.ok) {
        setVendors(data.data);
        setTotalPages(data.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [selectedStatus, page]);

  const handleApprove = async (vendorId: string) => {
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        toastSuccess('Vendor approved successfully');
        fetchVendors(); // Refresh the list
      } else {
        const data = await response.json();
        toastError('Failed to approve vendor', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to approve vendor:', error);
      toastError('Failed to approve vendor');
    }
  };

  const handleReject = async (vendorId: string) => {
    if (!confirm('Are you sure you want to reject this vendor?')) return;

    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        toastSuccess('Vendor rejected successfully');
        fetchVendors(); // Refresh the list
      } else {
        const data = await response.json();
        toastError('Failed to reject vendor', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to reject vendor:', error);
      toastError('Failed to reject vendor');
    }
  };

  const openSuspendModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setSuspensionReason('');
    setSuspendModalOpen(true);
  };

  const closeSuspendModal = () => {
    setSuspendModalOpen(false);
    setSelectedVendor(null);
    setSuspensionReason('');
  };

  const handleSuspend = async () => {
    if (!selectedVendor || !suspensionReason.trim()) {
      toastWarning('Please provide a suspension reason');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/vendors/${selectedVendor.id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspensionReason }),
      });

      const data = await response.json();

      if (response.ok) {
        toastSuccess(data.message || 'Vendor suspended successfully');
        closeSuspendModal();
        fetchVendors();
      } else {
        toastError('Failed to suspend vendor', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to suspend vendor:', error);
      toastError('An error occurred while suspending the vendor');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReinstate = async (vendorId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to reinstate ${companyName}? Their products will be restored.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/reinstate`, {
        method: 'PUT',
      });

      const data = await response.json();

      if (response.ok) {
        toastSuccess(data.message || 'Vendor reinstated successfully');
        fetchVendors();
      } else {
        toastError('Failed to reinstate vendor', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to reinstate vendor:', error);
      toastError('An error occurred while reinstating the vendor');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Approve or reject vendor applications</p>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'approved', 'rejected', 'suspended'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-md font-medium capitalize ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--background)] border border-[var(--border)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Vendors Table */}
        <div className="bg-[var(--surface)] rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">Loading...</div>
          ) : vendors.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              No {selectedStatus === 'all' ? '' : selectedStatus} vendors found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Website
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
              <tbody className="bg-[var(--surface)] divide-y divide-gray-200">
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--foreground)]">{vendor.companyName}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">{vendor.user.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--foreground)]">{vendor.contactEmail}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">{vendor.user.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {vendor.website ? (
                        <a
                          href={vendor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {vendor.website}
                        </a>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full inline-block w-fit ${
                            vendor.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : vendor.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : vendor.status === 'suspended'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {vendor.status}
                        </span>
                        {vendor.status === 'suspended' && vendor.suspensionReason && (
                          <span className="text-xs text-[var(--muted-foreground)] mt-1" title={vendor.suspensionReason}>
                            {vendor.suspensionReason.length > 30
                              ? vendor.suspensionReason.substring(0, 30) + '...'
                              : vendor.suspensionReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted-foreground)]">
                      {new Date(vendor.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        {vendor.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(vendor.id)}
                              disabled={isProcessing}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(vendor.id)}
                              disabled={isProcessing}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {vendor.status === 'approved' && (
                          <button
                            onClick={() => openSuspendModal(vendor)}
                            disabled={isProcessing}
                            className="px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Suspend
                          </button>
                        )}
                        {vendor.status === 'suspended' && (
                          <button
                            onClick={() => handleReinstate(vendor.id, vendor.companyName)}
                            disabled={isProcessing}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background)]"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background)]"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Suspend Vendor Modal */}
      {suspendModalOpen && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--foreground)]">
                Suspend Vendor
              </h3>
              <button
                onClick={closeSuspendModal}
                className="text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition-colors"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>Warning:</strong> Suspending this vendor will automatically archive all their published products. They will not be visible on the marketplace until reinstated.
                </p>
              </div>

              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-2">
                  <strong>Vendor:</strong> {selectedVendor.companyName}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Contact: {selectedVendor.contactEmail}
                </p>
              </div>

              <div>
                <label htmlFor="suspensionReason" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                  Suspension Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="suspensionReason"
                  rows={4}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Explain why this vendor is being suspended..."
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isProcessing}
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  This reason will be stored in the vendor's history.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-[var(--background)]">
              <button
                onClick={closeSuspendModal}
                disabled={isProcessing}
                className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] rounded-md hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={isProcessing || !suspensionReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Suspending...' : 'Suspend Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
