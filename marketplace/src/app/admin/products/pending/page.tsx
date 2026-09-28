"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast-helpers";

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  logo: string | null;
  website: string | null;
  pricingModel: string | null;
  startingPrice: number | null;
  submittedForApprovalAt: string;
  vendor: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
  categories: { id: string; name: string; slug: string }[];
  screenshots: { id: string; url: string; title: string | null; order: number }[];
}

export default function AdminPendingProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/products/pending?page=${page}&limit=20`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data.data);
        setTotalPages(data.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch pending products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const handleApprove = async (productId: string) => {
    if (!confirm('Approve this product? It will be published immediately.')) return;

    try {
      const response = await fetch(`/api/admin/products/${productId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });

      const data = await response.json();

      if (response.ok) {
        toastSuccess('Product approved and published successfully!');
        setSelectedProduct(null);
        setApprovalNotes("");
        fetchProducts();
      } else {
        toastError('Failed to approve product', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to approve product:', error);
      toastError('An error occurred while approving the product');
    }
  };

  const handleRequestRevision = async (productId: string) => {
    if (!revisionNotes.trim()) {
      toastWarning('Please provide revision notes');
      return;
    }

    if (!confirm('Request revision for this product? The vendor will be notified.')) return;

    try {
      const response = await fetch(`/api/admin/products/${productId}/request-revision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: revisionNotes }),
      });

      const data = await response.json();

      if (response.ok) {
        toastSuccess('Revision requested successfully!');
        setSelectedProduct(null);
        setRevisionNotes("");
        fetchProducts();
      } else {
        toastError('Failed to request revision', data.error || 'Please try again');
      }
    } catch (error) {
      console.error('Failed to request revision:', error);
      toastError('An error occurred while requesting revision');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Pending Product Approvals</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Review and approve vendor product submissions</p>
        </div>

        {isLoading ? (
          <div className="bg-[var(--surface)] rounded-lg shadow-md p-8 text-center text-[var(--muted-foreground)]">Loading...</div>
        ) : products.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-lg shadow-md p-8 text-center">
            <p className="text-[var(--muted-foreground)]">No products pending approval</p>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map((product) => (
              <div key={product.id} className="bg-[var(--surface)] rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start gap-6">
                    {/* Product Logo */}
                    <div className="flex-shrink-0">
                      {product.logo ? (
                        <Image
                          src={product.logo}
                          alt={product.name}
                          width={80}
                          height={80}
                          className="rounded-lg border"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-[var(--background)] rounded-lg flex items-center justify-center text-[var(--muted-foreground)]">
                          No Logo
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-[var(--foreground)]">{product.name}</h2>
                          <p className="text-sm text-[var(--muted-foreground)] mt-1">
                            by {product.vendor.companyName} • Submitted {new Date(product.submittedForApprovalAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}
                            className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 font-medium"
                          >
                            {selectedProduct?.id === product.id ? 'Close' : 'Review'}
                          </button>
                        </div>
                      </div>

                      <p className="mt-4 text-[var(--muted-foreground)]">{product.shortDescription}</p>

                      <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        {product.website && (
                          <div>
                            <span className="font-medium text-[var(--muted-foreground)]">Website: </span>
                            <a href={product.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {product.website}
                            </a>
                          </div>
                        )}
                        {product.pricingModel && (
                          <div>
                            <span className="font-medium text-[var(--muted-foreground)]">Pricing: </span>
                            <span className="text-[var(--foreground)]">{product.pricingModel}</span>
                            {product.startingPrice && <span className="text-[var(--foreground)]"> from ${product.startingPrice}</span>}
                          </div>
                        )}
                      </div>

                      {product.categories.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {product.categories.map((cat) => (
                            <span key={cat.id} className="px-3 py-1 bg-[var(--background)] text-[var(--muted-foreground)] rounded-full text-sm">
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Review Section */}
                  {selectedProduct?.id === product.id && (
                    <div className="mt-6 border-t pt-6">
                      <h3 className="text-lg font-bold mb-4">Product Details</h3>

                      <div className="mb-6">
                        <h4 className="font-medium text-[var(--foreground)] mb-2">Description</h4>
                        <p className="text-[var(--muted-foreground)] whitespace-pre-wrap">{product.description}</p>
                      </div>

                      {product.screenshots.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-medium text-[var(--foreground)] mb-2">Screenshots ({product.screenshots.length})</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {product.screenshots.map((screenshot) => (
                              <div key={screenshot.id} className="relative aspect-video">
                                <Image
                                  src={screenshot.url}
                                  alt={screenshot.title || product.name}
                                  fill
                                  className="rounded-lg border object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Approval Actions */}
                      <div className="bg-[var(--background)] rounded-lg p-6 space-y-4">
                        <div>
                          <h4 className="font-medium text-[var(--foreground)] mb-2">Approve Product</h4>
                          <textarea
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            placeholder="Optional approval notes (internal)"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            rows={2}
                          />
                          <button
                            onClick={() => handleApprove(product.id)}
                            className="mt-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                          >
                            Approve & Publish
                          </button>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-[var(--foreground)] mb-2">Request Revision</h4>
                          <textarea
                            value={revisionNotes}
                            onChange={(e) => setRevisionNotes(e.target.value)}
                            placeholder="Explain what needs to be changed (will be sent to vendor)"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            rows={3}
                          />
                          <button
                            onClick={() => handleRequestRevision(product.id)}
                            className="mt-2 px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium"
                          >
                            Request Revision
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
