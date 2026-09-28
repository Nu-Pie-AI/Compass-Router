'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Clock, CheckCircle2, XCircle, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PartnerApprovalInfo {
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  companyName: string | null;
  createdAt: string;
  rejectionReason?: string | null;
}

export default function ApprovalPendingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [approvalInfo, setApprovalInfo] = useState<PartnerApprovalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Fetch approval status
    const fetchApprovalStatus = async () => {
      try {
        const response = await fetch('/api/partners/approval-status');
        if (response.ok) {
          const data = await response.json();
          setApprovalInfo(data);

          // If approved, redirect to dashboard
          if (data.approvalStatus === 'APPROVED') {
            router.push('/partners/dashboard');
          }
        }
      } catch (error) {
        console.error('Failed to fetch approval status:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchApprovalStatus();
    }
  }, [session, status, router]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_50%)]"></div>

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl"></div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full">
        {approvalInfo?.approvalStatus === 'PENDING' && (
          <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8 md:p-12">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] text-center mb-4">
              Account Under Review
            </h1>

            {/* Description */}
            <p className="text-lg text-[var(--muted-foreground)] text-center mb-8">
              Thank you for registering as a partner! Your account for{' '}
              <span className="font-semibold text-[var(--foreground)]">
                {approvalInfo.companyName || 'your company'}
              </span>{' '}
              is currently under review by our team.
            </p>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">What happens next?</h3>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li>• Our team will review your partner application</li>
                    <li>• This typically takes 1-2 business days</li>
                    <li>• You'll receive an email notification once your account is approved</li>
                    <li>• After approval, you can log in and start onboarding your offerings</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Account details */}
            <div className="bg-[var(--background)] rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-[var(--foreground)] mb-3">Account Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--muted-foreground)]">Company:</span>
                  <span className="ml-2 text-[var(--foreground)] font-medium">
                    {approvalInfo.companyName}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">Status:</span>
                  <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                    <Clock className="w-3 h-3" />
                    Pending Approval
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">Email:</span>
                  <span className="ml-2 text-[var(--foreground)]">{session?.user?.email}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)]">Submitted:</span>
                  <span className="ml-2 text-[var(--foreground)]">
                    {new Date(approvalInfo.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--background)] text-[var(--muted-foreground)] rounded-xl hover:bg-[var(--background)] transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg hover:shadow-xl"
              >
                Check Status
              </button>
            </div>
          </div>
        )}

        {approvalInfo?.approvalStatus === 'REJECTED' && (
          <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8 md:p-12">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] text-center mb-4">
              Application Not Approved
            </h1>

            {/* Description */}
            <p className="text-lg text-[var(--muted-foreground)] text-center mb-8">
              Unfortunately, your partner application has not been approved at this time.
            </p>

            {approvalInfo.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
                <h3 className="font-semibold text-red-900 mb-2">Reason:</h3>
                <p className="text-red-800">{approvalInfo.rejectionReason}</p>
              </div>
            )}

            {/* Contact info */}
            <div className="bg-[var(--background)] rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-[var(--foreground)] mb-2">Need Help?</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                If you believe this is a mistake or would like to discuss your application,
                please contact our partnership team at{' '}
                <a href="mailto:partnerships@nexus.com" className="text-blue-600 hover:underline">
                  partnerships@nexus.com
                </a>
              </p>
            </div>

            {/* Action button */}
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-[var(--background)] text-[var(--muted-foreground)] rounded-xl hover:bg-[var(--background)] transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        )}

        {approvalInfo?.approvalStatus === 'APPROVED' && (
          <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8 md:p-12">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] text-center mb-4">
              Account Approved!
            </h1>

            {/* Description */}
            <p className="text-lg text-[var(--muted-foreground)] text-center mb-8">
              Your partner account has been approved. Redirecting to dashboard...
            </p>

            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
