"use client";

import { useState, useEffect, use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  shortDescription: z.string().min(1, "Short description is required").max(200),
  description: z.string().min(1, "Description is required"),
  categoryIds: z.array(z.string()).min(1, "At least one category is required"),
  companyName: z.string().optional(),
  companySize: z.string().optional(),
  founded: z.number().optional(),
  headquarters: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal('')),
  pricingModel: z.string().optional(),
  startingPrice: z.number().optional(),
  hasFreeTrial: z.boolean().optional(),
  logo: z.string().url("Invalid URL").optional().or(z.literal('')),
  videoUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<string>('');
  const [revisionNotes, setRevisionNotes] = useState<string>('');
  const router = useRouter();

  // Redirect to partners offerings - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/offerings');
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    // Fetch categories and product data
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesRes = await fetch('/api/categories');
        if (categoriesRes.ok) {
          const categoriesResult = await categoriesRes.json();
          setCategories(categoriesResult.data || []);
        }

        // Fetch vendor's own products to find this one
        const productsRes = await fetch('/api/vendors/products?status=all');
        if (productsRes.ok) {
          const productsResult = await productsRes.json();
          const products = productsResult.data || [];
          const product = products.find((p: any) => p.id === id);

          if (product) {
            // Store approval status and revision notes
            setApprovalStatus(product.approvalStatus || 'not_submitted');
            setRevisionNotes(product.revisionNotes || '');

            // Check if product can be edited
            if (product.approvalStatus === 'pending_approval') {
              setServerError('This product is currently under review and cannot be edited. Please wait for admin approval.');
            } else if (product.approvalStatus === 'approved') {
              setServerError('This product is already approved and published. Contact support if you need to make changes.');
            }

            // Pre-fill form with existing product data
            reset({
              name: product.name,
              slug: product.slug,
              shortDescription: product.shortDescription,
              description: product.description,
              categoryIds: product.categories?.map((c: any) => c.id) || [],
              companyName: product.companyName || '',
              companySize: product.companySize || '',
              founded: product.founded ? parseInt(product.founded) : undefined,
              headquarters: product.headquarters || '',
              website: product.website || '',
              pricingModel: product.pricingModel || '',
              startingPrice: product.startingPrice || undefined,
              hasFreeTrial: product.hasFreeTrial || false,
              logo: product.logo || '',
              videoUrl: product.videoUrl || '',
            });
          } else {
            setServerError('Product not found or you do not have permission to edit it');
          }
        } else {
          setServerError('Failed to load products');
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setServerError('Failed to load product data');
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [id, reset]);

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // Transform empty strings to undefined for URL fields
      const cleanedData = {
        ...data,
        website: data.website || undefined,
        logo: data.logo || undefined,
        videoUrl: data.videoUrl || undefined,
        companyName: data.companyName || undefined,
        companySize: data.companySize || undefined,
        headquarters: data.headquarters || undefined,
        pricingModel: data.pricingModel || undefined,
      };

      const response = await fetch(`/api/vendors/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      const result = await response.json();
      console.log("Update API Response:", result);

      if (!response.ok) {
        // Handle Zod validation errors
        if (Array.isArray(result.error)) {
          const errorMessages = result.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
          setServerError(errorMessages);
        } else {
          setServerError(result.error || "Failed to update product");
        }
        setIsLoading(false);
        return;
      }

      router.push('/vendors/products');
    } catch (error) {
      console.error("Product update error:", error);
      setServerError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Update your product listing</p>
        </div>

        {serverError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
            {serverError}
          </div>
        )}

        {/* Revision Notes Warning */}
        {approvalStatus === 'needs_revision' && revisionNotes && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md mb-6">
            <h3 className="font-semibold mb-2">⚠️ Revision Requested by Admin</h3>
            <p className="text-sm">{revisionNotes}</p>
            <p className="text-sm mt-2 font-medium">Please make the requested changes and submit again for approval.</p>
          </div>
        )}

        {/* Approval Status Info */}
        {approvalStatus === 'pending_approval' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md mb-6">
            <h3 className="font-semibold mb-2">🔄 Under Review</h3>
            <p className="text-sm">This product is currently being reviewed by an admin. You cannot make edits until the review is complete.</p>
          </div>
        )}

        {approvalStatus === 'approved' && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md mb-6">
            <h3 className="font-semibold mb-2">✅ Approved & Published</h3>
            <p className="text-sm">This product is approved and live on the marketplace. Contact support if you need to make changes.</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Info Section */}
          <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name *</label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Slug *</label>
                <input
                  type="text"
                  {...register("slug")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.slug && (
                  <p className="text-red-600 text-sm mt-1">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Short Description *</label>
                <input
                  type="text"
                  {...register("shortDescription")}
                  maxLength={200}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.shortDescription && (
                  <p className="text-red-600 text-sm mt-1">{errors.shortDescription.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  {...register("description")}
                  rows={6}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.description && (
                  <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categories *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-[var(--border)] rounded-md p-3">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center">
                      <input
                        type="checkbox"
                        value={category.id}
                        {...register("categoryIds")}
                        className="mr-2"
                      />
                      <span className="text-sm">{category.name}</span>
                    </label>
                  ))}
                </div>
                {errors.categoryIds && (
                  <p className="text-red-600 text-sm mt-1">{errors.categoryIds.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Company Details Section */}
          <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Company Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  {...register("companyName")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Company Size</label>
                <select
                  {...register("companySize")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="501+">501+ employees</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Founded Year</label>
                <input
                  type="number"
                  {...register("founded", { valueAsNumber: true })}
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Headquarters</label>
                <input
                  type="text"
                  {...register("headquarters")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Website</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  {...register("website")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.website && (
                  <p className="text-red-600 text-sm mt-1">{errors.website.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Pricing</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Pricing Model</label>
                <select
                  {...register("pricingModel")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select model</option>
                  <option value="Free">Free</option>
                  <option value="Freemium">Freemium</option>
                  <option value="Subscription">Subscription</option>
                  <option value="One-time">One-time</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Starting Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("startingPrice", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register("hasFreeTrial")}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Has Free Trial</span>
                </label>
              </div>
            </div>
          </div>

          {/* Media Section */}
          <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Media</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Logo URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  {...register("logo")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.logo && (
                  <p className="text-red-600 text-sm mt-1">{errors.logo.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Video URL</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  {...register("videoUrl")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.videoUrl && (
                  <p className="text-red-600 text-sm mt-1">{errors.videoUrl.message}</p>
                )}
                <p className="text-[var(--muted-foreground)] text-xs mt-1">YouTube or Vimeo URL</p>
              </div>
            </div>
          </div>

          {/* Approval Process Info */}
          {(approvalStatus === 'not_submitted' || approvalStatus === 'needs_revision') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">📋 Next Steps</h3>
              <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                <li>Save your changes</li>
                <li>Return to the products list</li>
                <li>Click "Submit" to send for admin approval</li>
                <li>Wait for admin to review and approve</li>
                <li>Once approved, your product will be published</li>
              </ol>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/vendors/products')}
              disabled={isLoading}
              className="px-6 py-3 border border-[var(--border)] rounded-md hover:bg-[var(--background)] disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || approvalStatus === 'pending_approval' || approvalStatus === 'approved'}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
