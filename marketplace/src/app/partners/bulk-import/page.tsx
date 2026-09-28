'use client';

// ============================================
// PARTNER CSV/XLSX BULK IMPORT
// ============================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';

interface ImportResult {
  totalRows: number;
  validRows: number;
  offeringsCreated: number;
  errors: string[];
  warnings: string[];
  fileType: 'csv' | 'xlsx';
  onboardingCompleted?: boolean;
}

interface UploadResponse {
  totalRows: number;
  validRows: number;
  normalizedData: unknown[];
  errors: string[];
  warnings: string[];
  fileType: 'csv' | 'xlsx';
}

export default function BulkImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    const lowerName = selectedFile.name.toLowerCase();
    if (lowerName.endsWith('.xls')) {
      setError('Legacy .xls files are not supported. Please upload CSV or XLSX.');
      return;
    }
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      setError('Please select a CSV or XLSX file');
      return;
    }

    setFile(selectedFile);
    setError('');
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV or XLSX file first');
      return;
    }

    setUploading(true);
    setProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/partners/bulk-import/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = (await uploadResponse.json()) as UploadResponse & {
        error?: string;
        message?: string;
      };

      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || uploadData.error || 'Failed to upload import file');
      }

      setUploading(false);

      const enrichResponse = await fetch('/api/partners/bulk-import/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normalizedData: uploadData.normalizedData,
          fileType: uploadData.fileType,
          totalRows: uploadData.totalRows,
          warnings: uploadData.warnings,
        }),
      });

      const enrichData = (await enrichResponse.json()) as {
        offeringsCreated: number;
        errors?: string[];
        warnings?: string[];
        onboardingCompleted?: boolean;
        message?: string;
        error?: string;
      };

      if (!enrichResponse.ok) {
        throw new Error(enrichData.message || enrichData.error || 'Failed to process bulk import');
      }

      setResult({
        totalRows: uploadData.totalRows,
        validRows: uploadData.validRows,
        offeringsCreated: enrichData.offeringsCreated,
        errors: [...uploadData.errors, ...(enrichData.errors || [])],
        warnings: [...uploadData.warnings, ...(enrichData.warnings || [])],
        fileType: uploadData.fileType,
        onboardingCompleted: enrichData.onboardingCompleted,
      });

      setProcessing(false);
    } catch (err: unknown) {
      console.error('Bulk import error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during bulk import');
      setUploading(false);
      setProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `offeringName,type,offeringSummary,offeringDescription,websiteUrl,category,integrations,pricingModel,startingPrice,hasFreeTrial,regions,companyName,partnerWebsite,partnerDescription,industry,companySize,complianceFlags
SmartCRM Pro,PRODUCT,"AI-powered CRM for SMB sales teams. Manage leads, automate follow-ups, and improve pipeline visibility with Gmail, Outlook, and Slack integrations.","SmartCRM Pro helps growing SMB sales teams organize contacts, manage pipelines, automate reminders, and review sales performance dashboards across distributed teams.",https://smartcrmpro.example.com,crm,"Gmail,Outlook,Slack,Zapier",per-seat,2499,true,"India,United States",ANC Pvt Ltd,https://anc.example.com,"ANC Pvt Ltd builds software products for SMB growth, sales, and operations teams.",SaaS,11-50,"SOC2,GDPR"
OpsFlow Suite,PRODUCT,"Workflow automation for operations teams. Standardize approvals, routing, and reporting across finance and support workflows.","OpsFlow Suite gives SMB operations teams workflow automation, approval management, task routing, and reporting dashboards with Slack, HubSpot, and QuickBooks integrations.",https://opsflow.example.com,project management,"Slack,HubSpot,QuickBooks",paid,4999,false,"India,United Kingdom",ANC Pvt Ltd,https://anc.example.com,"ANC Pvt Ltd builds software products for SMB growth, sales, and operations teams.",SaaS,11-50,"SOC2,ISO 27001"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_import_template.csv';
    link.click();
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="relative mb-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="absolute inset-0 bg-mesh opacity-35" />
          <div className="relative mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--primary)]">
            <FileSpreadsheet className="h-4 w-4" />
            Partner import
          </div>
          <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                Bulk Import Offerings
              </h1>
              <p className="text-[var(--muted-foreground)]">
                Import multiple offerings with structured offering details, optional website context, and partner/company information.
              </p>
            </div>
            <Link
              href="/partners/dashboard"
              className="bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
          </div>
        </div>

        <div className="bg-[var(--secondary)]/10 rounded-lg p-6 border border-[var(--secondary)]/20 mb-6">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-3">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-[var(--muted-foreground)]">
            <li>Use one row per offering with core details like <code>offeringName</code>, <code>offeringSummary</code>, and optional <code>websiteUrl</code>.</li>
            <li>Add partner/company fields only where they apply to the overall partner profile.</li>
            <li>Upload the completed CSV or XLSX file.</li>
            <li>AI enriches each offering, merges partner data safely, and sends the results to review before publishing.</li>
          </ol>
        </div>

        <div className="bg-[var(--surface)] rounded-lg shadow-sm p-6 border border-[var(--border)] mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
            File Format Requirements
          </h2>

          <div className="space-y-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--foreground)]">
                Supported files:
              </span>
              <p className="text-[var(--muted-foreground)] mt-1">
                CSV (`.csv`) and Excel (`.xlsx`) only. Legacy `.xls` files are not supported.
              </p>
            </div>

            <div>
              <span className="font-semibold text-[var(--foreground)]">
                Offering columns:
              </span>
              <ul className="list-disc list-inside ml-4 text-[var(--muted-foreground)] mt-1 space-y-1">
                <li>
                  <code className="bg-[var(--background)] px-1 rounded">offeringName</code> and{' '}
                  <code className="bg-[var(--background)] px-1 rounded">type</code> are required
                </li>
                <li>
                  Use <code className="bg-[var(--background)] px-1 rounded">offeringSummary</code> for the short summary and{' '}
                  <code className="bg-[var(--background)] px-1 rounded">websiteUrl</code> for the optional website context
                </li>
                <li>
                  You can also include <code className="bg-[var(--background)] px-1 rounded">offeringDescription</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">category</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">integrations</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">pricingModel</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">startingPrice</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">hasFreeTrial</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">regions</code> as needed
                </li>
              </ul>
            </div>

            <div>
              <span className="font-semibold text-[var(--foreground)]">
                Partner/company columns:
              </span>
              <ul className="list-disc list-inside ml-4 text-[var(--muted-foreground)] mt-1 space-y-1">
                <li>
                  <code className="bg-[var(--background)] px-1 rounded">companyName</code> is required
                </li>
                <li>
                  Optional partner fields:{' '}
                  <code className="bg-[var(--background)] px-1 rounded">partnerWebsite</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">partnerDescription</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">industry</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">companySize</code>,{' '}
                  <code className="bg-[var(--background)] px-1 rounded">complianceFlags</code>
                </li>
                <li>Partner data is merged safely and will not overwrite existing non-empty profile fields from previous onboarding or imports.</li>
              </ul>
            </div>
          </div>

          <button
            onClick={downloadTemplate}
            className="mt-4 bg-[#4DBC65]/10 hover:bg-[#4DBC65]/15 text-[#2f8f47] border border-[#4DBC65]/25 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Download Import Template
          </button>
        </div>

        {!result && (
          <div className="bg-[var(--surface)] rounded-lg shadow-sm p-8 border border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">
              Upload Your Import File
            </h2>

            <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="import-upload"
              />
              <label
                htmlFor="import-upload"
                className="cursor-pointer inline-block bg-[var(--secondary)]/10 hover:bg-[var(--secondary)]/15 text-[var(--secondary)] border border-[var(--secondary)]/20 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Choose CSV or XLSX File
              </label>
              {file && (
                <div className="mt-4">
                  <p className="text-[var(--foreground)] font-medium">
                    Selected: {file.name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Size: {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading || processing}
              className="mt-6 w-full bg-[#4DBC65] hover:bg-[#3fa656] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading
                ? 'Uploading...'
                : processing
                ? 'Processing with AI...'
                : 'Upload and Process'}
            </button>

            {processing && (
              <div className="mt-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#4DBC65] mx-auto mb-4"></div>
                <p className="text-[var(--muted-foreground)] font-medium">
                  {uploading
                    ? 'Parsing your file...'
                    : 'AI is enriching offerings and aligning partner data...'}
                </p>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                  This may take a minute for larger files.
                </p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200 text-center">
              <div className="text-5xl mb-3">✓</div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">
                Import Complete
              </h2>
              <p className="text-lg text-green-700">
                {result.offeringsCreated} offering(s) created from {result.totalRows} row(s)
              </p>
              <p className="text-sm text-green-700 mt-2 uppercase tracking-wide">
                Source format: {result.fileType}
              </p>
              {result.onboardingCompleted && (
                <p className="text-sm text-green-700 mt-2">
                  Partner onboarding details were updated from this import.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[var(--surface)] rounded-lg shadow-md p-6 border border-[var(--border)]">
                <div className="text-3xl font-bold text-[var(--foreground)]">{result.totalRows}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Total Rows</div>
              </div>
              <div className="bg-green-50 rounded-lg shadow-md p-6 border-2 border-green-300">
                <div className="text-3xl font-bold text-green-700">{result.validRows}</div>
                <div className="text-sm text-green-600">Valid Rows</div>
              </div>
              <div className="bg-blue-50 rounded-lg shadow-md p-6 border-2 border-blue-300">
                <div className="text-3xl font-bold text-blue-700">{result.offeringsCreated}</div>
                <div className="text-sm text-blue-600">Offerings Created</div>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-yellow-900 mb-3">
                  Warnings ({result.warnings.length})
                </h3>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
                <h3 className="text-lg font-bold text-red-900 mb-3">
                  Errors ({result.errors.length})
                </h3>
                <ul className="list-disc list-inside space-y-1 text-red-800 text-sm">
                  {result.errors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => router.push('/partners/offerings/review')}
                className="flex-1 bg-[#4DBC65] hover:bg-[#3fa656] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Review Offerings →
              </button>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError('');
                }}
                className="flex-1 bg-[var(--background)] hover:bg-[var(--border)] text-[var(--muted-foreground)] font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
