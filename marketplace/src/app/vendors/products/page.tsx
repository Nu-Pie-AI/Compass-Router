"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

interface Product {
  id: string;
  name: string;
  slug: string;
  status: string;
  approvalStatus: string;
  revisionRequested: boolean;
  revisionNotes: string | null;
  categories: { id: string; name: string; slug: string }[];
  _count: { reviews: number };
}

export default function VendorProductsPage() {
  const router = useRouter();

  // Redirect to partners offerings - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/offerings');
  }, [router]);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vendors/products?status=${selectedStatus}&page=${page}`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data.data);
        setTotalPages(data.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedStatus, page]);

  const handleArchive = async (productId: string) => {
    if (!confirm('Are you sure you want to archive this product?')) return;

    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toastSuccess('Product archived successfully');
        fetchProducts(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to archive product:', error);
      toastError('Failed to archive product');
    }
  };

  const handleSubmitForApproval = async (productId: string) => {
    if (!confirm('Submit this product for admin approval? You won\'t be able to edit it until it\'s reviewed.')) return;

    try {
      const response = await fetch(`/api/vendors/products/${productId}/submit`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toastSuccess('Product submitted for approval successfully!');
        fetchProducts(); // Refresh the list
      } else {
        toastError('Failed to submit product', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to submit product:', error);
      toastError('An error occurred while submitting the product');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Products</h1>
            <p className="text-[var(--muted-foreground)] mt-2">Manage your product listings</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/vendors/products/bulk-import"
              className="px-6 py-3 bg-[var(--surface)] border-2 border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 font-medium"
            >
              Bulk Import
            </Link>
            <Link
              href="/vendors/products/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Add Product
            </Link>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-2">
            {['all', 'draft', 'published'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-md font-medium capitalize ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--background)]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-[var(--surface)] rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[var(--muted-foreground)] mb-4">
                No {selectedStatus === 'all' ? '' : selectedStatus} products found
              </p>
              <Link
                href="/vendors/products/new"
                className="text-blue-600 hover:underline font-medium"
              >
                Add your first product
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[var(--background)] border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Approval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Reviews
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--surface)] divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--foreground)]">{product.name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">/{product.slug}</div>
                      {product.revisionRequested && product.revisionNotes && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <span className="font-medium text-yellow-800">Revision needed: </span>
                          <span className="text-yellow-700">{product.revisionNotes}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-[var(--background)] text-[var(--foreground)]'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.approvalStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : product.approvalStatus === 'pending_approval'
                            ? 'bg-blue-100 text-blue-800'
                            : product.approvalStatus === 'needs_revision'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-[var(--background)] text-[var(--foreground)]'
                        }`}
                      >
                        {product.approvalStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted-foreground)]">
                      {product.categories.map((cat) => cat.name).join(', ') || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted-foreground)]">
                      {product._count.reviews}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        {(product.approvalStatus === 'not_submitted' || product.approvalStatus === 'needs_revision') && (
                          <>
                            <Link
                              href={`/vendors/products/${product.id}/edit`}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleSubmitForApproval(product.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                            >
                              Submit
                            </button>
                          </>
                        )}
                        {product.approvalStatus === 'pending_approval' && (
                          <span className="px-3 py-1 text-[var(--muted-foreground)] text-sm">Under Review</span>
                        )}
                        {product.approvalStatus === 'approved' && (
                          <>
                            <Link
                              href={`/products/${product.slug}`}
                              className="px-3 py-1 bg-[var(--foreground)] text-white rounded-md hover:opacity-80 text-sm font-medium"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleArchive(product.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                            >
                              Archive
                            </button>
                          </>
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
    </div>
  );
}
