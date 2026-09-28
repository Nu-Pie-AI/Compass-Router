import { redirect } from "next/navigation";

export default function VendorRegisterSuccessPage() {
  // Redirect to partners - Vendor portal is hidden
  redirect('/partners');

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="bg-[var(--surface)] p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-4">Registration Successful!</h1>

        <p className="text-[var(--muted-foreground)] mb-6">
          Thank you for registering as a vendor. Your account is pending approval from our admin team.
        </p>

        <div className="bg-blue-50 p-4 rounded-md mb-6">
          <p className="text-sm text-blue-800">
            <strong>What's next?</strong>
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 text-left list-disc list-inside">
            <li>Our team will review your application</li>
            <li>You'll receive an email once your account is approved</li>
            <li>After approval, you can log in and start managing your products</li>
          </ul>
        </div>

        <div className="space-y-3">
          <a
            href="/"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
          >
            Back to Home
          </a>
          <a
            href="/login"
            className="block w-full border border-[var(--border)] py-2 px-4 rounded-md hover:bg-[var(--background)]"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}
