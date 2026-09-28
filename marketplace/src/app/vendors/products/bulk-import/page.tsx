"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2
} from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportError {
  row: number;
  error: string;
}

interface CreatedProduct {
  row: number;
  productId: string;
  name: string;
  slug: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  totalRows: number;
  successfulRows?: number;
  validRows?: number;
  failedRows?: number;
  errorRows?: number;
  createdProducts?: CreatedProduct[];
  errors?: ValidationError[] | ImportError[];
}

export default function BulkImportPage() {
  const router = useRouter();

  // Redirect to partners bulk import - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners/bulk-import');
  }, [router]);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch categories on mount
  // useState(() => {
  //   fetch('/api/categories')
  //     .then(res => res.json())
  //     .then(data => setCategories(data.data || []));
  // });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };

    fetchCategories();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toastError('Please upload a CSV file');
        return;
      }
      setCsvFile(file);
      setResult(null);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const product: any = {};

      headers.forEach((header, index) => {
        const value = values[index];

        if (header === 'categoryIds') {
          // Split category IDs by semicolon
          product.categoryIds = value ? value.split(';').map(id => id.trim()) : [];
        } else if (header === 'startingPrice') {
          product.startingPrice = value ? parseFloat(value) : null;
        } else if (header === 'hasFreeTrial') {
          product.hasFreeTrial = value === 'true' || value === 'TRUE' || value === '1';
        } else {
          product[header] = value || null;
        }
      });

      products.push(product);
    }

    return products;
  };

  const handleUpload = async () => {
    if (!csvFile) {
      toastError('Please select a CSV file');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const text = await csvFile.text();
      const products = parseCSV(text);

      const response = await fetch('/api/vendors/products/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toastSuccess('CSV import complete', data.message || 'Products were imported successfully');
        // Clear file after successful import
        setCsvFile(null);
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toastError('CSV import failed', data.message || 'Please review the errors below');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toastError('CSV import failed', error.message || 'Failed to process CSV file');
      setResult({
        success: false,
        message: error.message || 'Failed to process CSV file',
        totalRows: 0,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,slug,shortDescription,description,categoryIds,website,logo,pricingModel,startingPrice,hasFreeTrial,companyName,companySize,founded,headquarters
"Sample CRM Pro","sample-crm-pro","Powerful CRM for small businesses","A comprehensive CRM solution designed for small to medium businesses. Features include contact management, sales pipeline, email integration, and reporting.","${categories[0]?.id || 'CATEGORY_ID'}","https://example.com","https://via.placeholder.com/200","freemium",29.99,true,"Sample Tech Inc","SMB",2020,"San Francisco, CA"
"Project Manager Plus","project-manager-plus","Manage projects with ease","Complete project management solution with task tracking, team collaboration, time tracking, and resource management.","${categories[1]?.id || 'CATEGORY_ID'}","https://example.com","https://via.placeholder.com/200","paid",49.99,true,"Sample Software","SMB",2019,"New York, NY"
"Analytics Dashboard","analytics-dashboard","Business intelligence made simple","Advanced analytics platform for data visualization, reporting, and business intelligence.","${categories[2]?.id || 'CATEGORY_ID'}","https://example.com","https://via.placeholder.com/200","paid",99.99,false,"Data Corp","SMB",2021,"Austin, TX"`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/vendors/products"
            className="inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Link>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Bulk Product Import</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Upload a CSV file to import multiple products at once
          </p>
        </div>

        {/* Instructions Card */}
        <div className="bg-[var(--surface)] border-2 border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--foreground)] mb-2">CSV Format Requirements</h3>
              <ul className="text-sm text-[var(--muted-foreground)] space-y-1">
                <li>• File must be in CSV format (.csv)</li>
                <li>• Maximum 100 products per upload</li>
                <li>• Required fields: name, slug, shortDescription, description, categoryIds</li>
                <li>• Category IDs should be separated by semicolons (e.g., "id1;id2;id3")</li>
                <li>• All products will be created as drafts (status: draft)</li>
                <li>• Submit individual products for approval after import</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Template Download */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">Download Template</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Get a pre-filled CSV template with sample data
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>
        </div>

        {/* Available Categories */}
        {categories.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-[var(--foreground)] mb-3">Available Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {categories.map(cat => (
                <div key={cat.id} className="text-[var(--muted-foreground)]">
                  <span className="font-mono text-xs text-blue-600">{cat.id}</span>
                  {' - '}
                  <span>{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-lg p-8 mb-6">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-[var(--background)] rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Upload CSV File</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4 text-center">
              Select a CSV file from your computer to begin importing products
            </p>

            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="csv-file"
              className="px-6 py-3 bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--muted-foreground)] rounded-md hover:bg-[var(--background)] transition-colors cursor-pointer"
            >
              Choose File
            </label>

            {csvFile && (
              <div className="mt-4 text-center">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Selected: <span className="font-medium">{csvFile.name}</span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Size: {(csvFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {csvFile && (
              <button
                onClick={handleUpload}
                disabled={isProcessing}
                className="mt-6 px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Import Products
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className={`bg-[var(--surface)] border-2 rounded-lg p-6 ${
            result.success ? 'border-green-500' : 'border-red-500'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              {result.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${
                  result.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {result.message}
                </h3>

                {/* Statistics */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[var(--background)] rounded-lg p-3">
                    <div className="text-2xl font-bold text-[var(--foreground)]">{result.totalRows}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">Total Rows</div>
                  </div>
                  {result.successfulRows !== undefined && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-900">{result.successfulRows}</div>
                      <div className="text-xs text-green-700">Successful</div>
                    </div>
                  )}
                  {result.validRows !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-900">{result.validRows}</div>
                      <div className="text-xs text-blue-700">Valid</div>
                    </div>
                  )}
                  {(result.failedRows !== undefined || result.errorRows !== undefined) && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-900">
                        {result.failedRows || result.errorRows || 0}
                      </div>
                      <div className="text-xs text-red-700">Errors</div>
                    </div>
                  )}
                </div>

                {/* Created Products */}
                {result.createdProducts && result.createdProducts.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-[var(--foreground)] mb-3">Created Products</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {result.createdProducts.map((product) => (
                        <div key={product.productId} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{product.name}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Slug: {product.slug}</p>
                          </div>
                          <Link
                            href={`/vendors/products/${product.productId}/edit`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-red-900 mb-3">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Errors ({result.errors.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {result.errors.map((error: any, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-900">
                            Row {error.row}
                            {error.field && ` - ${error.field}`}
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            {error.message || error.error}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
