"use client";

import { useState, useEffect } from "react";
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

export default function NewProductPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const router = useRouter();

  // Redirect to partners offerings - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/offerings/new');
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      hasFreeTrial: false,
      categoryIds: [],
    },
  });

  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const result = await response.json();
          setCategories(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  // Auto-generate slug from name
  const watchName = watch('name');
  useEffect(() => {
    if (watchName) {
      const slug = watchName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', slug);
    }
  }, [watchName, setValue]);

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // Transform empty strings to undefined for URL fields
      const cleanedData = {
        ...data,
        status: 'draft', // Always save as draft - vendors cannot directly publish
        website: data.website || undefined,
        logo: data.logo || undefined,
        videoUrl: data.videoUrl || undefined,
        companyName: data.companyName || undefined,
        companySize: data.companySize || undefined,
        headquarters: data.headquarters || undefined,
        pricingModel: data.pricingModel || undefined,
      };

      const response = await fetch("/api/vendors/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      const result = await response.json();
      console.log("API Response:", result);

      if (!response.ok) {
        // Handle Zod validation errors
        if (Array.isArray(result.error)) {
          const errorMessages = result.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
          setServerError(errorMessages);
        } else {
          setServerError(result.error || "Failed to create product");
        }
        setIsLoading(false);
        return;
      }

      router.push('/vendors/products');
    } catch (error) {
      console.error("Product creation error:", error);
      setServerError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Add New Product</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Create a new product listing</p>
        </div>

        {serverError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Info Section */}
          <div className="bg-[var(--surface)] p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Name *
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  {...register("slug")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--background)]"
                  readOnly
                />
                {errors.slug && (
                  <p className="text-red-600 text-sm mt-1">{errors.slug.message}</p>
                )}
                <p className="text-[var(--muted-foreground)] text-xs mt-1">Auto-generated from product name</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Short Description *
                </label>
                <input
                  type="text"
                  {...register("shortDescription")}
                  maxLength={200}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.shortDescription && (
                  <p className="text-red-600 text-sm mt-1">{errors.shortDescription.message}</p>
                )}
                <p className="text-[var(--muted-foreground)] text-xs mt-1">Maximum 200 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description *
                </label>
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
                <label className="block text-sm font-medium mb-2">
                  Categories *
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  {...register("companyName")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Company Size
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Founded Year
                </label>
                <input
                  type="number"
                  {...register("founded", { valueAsNumber: true })}
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Headquarters
                </label>
                <input
                  type="text"
                  {...register("headquarters")}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Website
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Pricing Model
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Starting Price ($)
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Logo URL
                </label>
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
                <label className="block text-sm font-medium mb-1">
                  Video URL
                </label>
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📋 Product Approval Process</h3>
            <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
              <li>Save your product as a draft</li>
              <li>Review and edit until you're satisfied</li>
              <li>Submit for admin approval from your products list</li>
              <li>Admin will review and either approve or request revisions</li>
              <li>Once approved, your product will be published to the marketplace</li>
            </ol>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Saving...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
