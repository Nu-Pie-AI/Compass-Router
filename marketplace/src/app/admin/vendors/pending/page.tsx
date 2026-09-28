"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Mail,
  Building2,
  MapPin,
  Globe,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft
} from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

interface Vendor {
  id: string;
  companyName: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

export default function PendingVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingVendors();
  }, []);

  const fetchPendingVendors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/vendors?status=pending');
      if (response.ok) {
        const data = await response.json();
        setVendors(data.data || []);
      } else {
        setError('Failed to load pending vendors');
      }
    } catch (err) {
      console.error('Pending vendors error:', err);
      setError('An error occurred while loading pending vendors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (vendorId: string) => {
    if (!confirm('Are you sure you want to approve this vendor?')) {
      return;
    }

    setProcessingId(vendorId);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });

      if (response.ok) {
        // Remove vendor from list
        setVendors(vendors.filter(v => v.id !== vendorId));
        toastSuccess('Vendor approved successfully!');
      } else {
        const data = await response.json();
        toastError('Failed to approve vendor', data.error || 'Please try again');
      }
    } catch (err) {
      console.error('Approve error:', err);
      toastError('An error occurred while approving the vendor');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (vendorId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
      return;
    }

    setProcessingId(vendorId);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        // Remove vendor from list
        setVendors(vendors.filter(v => v.id !== vendorId));
        toastSuccess('Vendor rejected successfully!');
      } else {
        const data = await response.json();
        toastError('Failed to reject vendor', data.error || 'Please try again');
      }
    } catch (err) {
      console.error('Reject error:', err);
      toastError('An error occurred while rejecting the vendor');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">Loading pending vendors...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Pending Vendors</h1>
              <p className="text-[var(--muted-foreground)] mt-2">
                Review and approve vendor applications
              </p>
            </div>
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">{vendors.length} Pending</span>
            </div>
          </div>
        </div>

        {/* Vendors List */}
        {vendors.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-lg shadow-md p-12 text-center">
            <Users className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              No Pending Vendors
            </h3>
            <p className="text-[var(--muted-foreground)]">
              All vendor applications have been reviewed!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-[var(--surface)] rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">
                        {vendor.companyName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)] mb-3">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{vendor.contactName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{vendor.contactEmail}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Applied {new Date(vendor.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {vendor.description && (
                        <p className="text-[var(--muted-foreground)] mb-3">{vendor.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {vendor.contactPhone && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <span className="font-medium">Phone:</span>
                            <span>{vendor.contactPhone}</span>
                          </div>
                        )}
                        {vendor.website && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <Globe className="w-4 h-4" />
                            <a
                              href={vendor.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Website
                            </a>
                          </div>
                        )}
                        {vendor.address && (
                          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                            <MapPin className="w-4 h-4" />
                            <span>{vendor.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                          <Mail className="w-4 h-4" />
                          <span>User: {vendor.user.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={() => handleApprove(vendor.id)}
                    disabled={processingId === vendor.id}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processingId === vendor.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(vendor.id)}
                    disabled={processingId === vendor.id}
                    className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    {processingId === vendor.id ? 'Processing...' : 'Reject'}
                  </button>
                  <Link
                    href={`/admin/vendors/${vendor.id}`}
                    className="flex items-center gap-2 px-6 py-2 bg-[var(--background)] text-[var(--foreground)] rounded-md hover:bg-[var(--border)] transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
