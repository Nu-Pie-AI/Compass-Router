"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface VendorStats {
  totalProducts: number;
  totalViews: number;
  totalReviews: number;
  totalLeads: number;
}

export default function VendorDashboardPage() {
  const router = useRouter();

  // Redirect to partners dashboard - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/dashboard');
  }, [router]);

  const [stats, setStats] = useState<VendorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/vendors/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Welcome back! Here's your performance overview.</p>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--surface)] p-6 rounded-lg shadow-md animate-pulse">
                <div className="h-4 bg-[var(--background)] rounded w-24 mb-2"></div>
                <div className="h-8 bg-[var(--background)] rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
              <p className="text-[var(--muted-foreground)] text-sm font-medium mb-1">Total Products</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalProducts}</p>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
              <p className="text-[var(--muted-foreground)] text-sm font-medium mb-1">Total Views (30d)</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalViews}</p>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
              <p className="text-[var(--muted-foreground)] text-sm font-medium mb-1">Total Reviews</p>
              <p className="text-3xl font-bold text-purple-600">{stats.totalReviews}</p>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
              <p className="text-[var(--muted-foreground)] text-sm font-medium mb-1">New Leads</p>
              <p className="text-3xl font-bold text-orange-600">{stats.totalLeads}</p>
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/vendors/products/new"
              className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Product
            </Link>

            <Link
              href="/vendors/leads"
              className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              View Leads
            </Link>

            <Link
              href="/vendors/products"
              className="flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Manage Products
            </Link>
          </div>
        </div>

        {/* Getting Started Guide */}
        {stats && stats.totalProducts === 0 && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-blue-900 mb-2">Getting Started</h3>
            <p className="text-blue-800 mb-4">
              Welcome to your vendor dashboard! Here's how to get started:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              <li>Add your first product using the "Add New Product" button above</li>
              <li>Complete your product details including features and pricing</li>
              <li>Publish your product to make it visible to customers</li>
              <li>Monitor leads and reviews from your dashboard</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
