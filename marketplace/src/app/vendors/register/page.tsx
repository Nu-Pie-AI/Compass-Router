"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

const vendorRegisterSchema = z.object({
  // Step 1: Account Info
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),

  // Step 2: Company Info
  companyName: z.string().min(2, "Company name is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),

  // Step 3: Contact Details
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

type VendorRegisterFormData = z.infer<typeof vendorRegisterSchema>;

export default function VendorRegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect to partners register - Vendor portal is hidden
  useEffect(() => {
    router.push('/partners');
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<VendorRegisterFormData>({
    resolver: zodResolver(vendorRegisterSchema),
    mode: "onBlur",
  });

  const validateStep = async (step: number) => {
    let fieldsToValidate: (keyof VendorRegisterFormData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['email', 'password', 'name'];
    } else if (step === 2) {
      fieldsToValidate = ['companyName', 'website', 'industry', 'companySize'];
    } else if (step === 3) {
      fieldsToValidate = ['contactEmail', 'contactPhone', 'address', 'city', 'country'];
    }

    const isValid = await trigger(fieldsToValidate);
    return isValid;
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(currentStep + 1);

      // Save to localStorage for draft functionality
      const formData = getValues();
      localStorage.setItem('vendorRegistrationDraft', JSON.stringify(formData));
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const onSubmit = async (data: VendorRegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || "Registration failed");
        toastError("Registration failed", result.error || "Please try again");
        setIsLoading(false);
        return;
      }

      // Clear draft from localStorage
      localStorage.removeItem('vendorRegistrationDraft');

      // Redirect to success page or login
      toastSuccess("Registration submitted", "Your account is pending approval.");
      router.push("/vendors/register/success");
    } catch (error) {
      setServerError("An unexpected error occurred");
      toastError("Registration failed", "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
              step === currentStep
                ? "bg-blue-600 text-white"
                : step < currentStep
                ? "bg-green-500 text-white"
                : "bg-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            {step < currentStep ? "✓" : step}
          </div>
          {step < 3 && (
            <div
              className={`w-16 h-1 ${
                step < currentStep ? "bg-green-500" : "bg-[var(--border)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">Account Information</h2>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email *
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password *
        </label>
        <input
          id="password"
          type="password"
          {...register("password")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.password && (
          <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
        )}
        <p className="text-[var(--muted-foreground)] text-xs mt-1">Minimum 8 characters</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Full Name *
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.name && (
          <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">Company Information</h2>

      <div>
        <label htmlFor="companyName" className="block text-sm font-medium mb-1">
          Company Name *
        </label>
        <input
          id="companyName"
          type="text"
          {...register("companyName")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.companyName && (
          <p className="text-red-600 text-sm mt-1">{errors.companyName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="website" className="block text-sm font-medium mb-1">
          Website
        </label>
        <input
          id="website"
          type="url"
          placeholder="https://example.com"
          {...register("website")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.website && (
          <p className="text-red-600 text-sm mt-1">{errors.website.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="industry" className="block text-sm font-medium mb-1">
          Industry
        </label>
        <select
          id="industry"
          {...register("industry")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        >
          <option value="">Select an industry</option>
          <option value="technology">Technology</option>
          <option value="finance">Finance</option>
          <option value="healthcare">Healthcare</option>
          <option value="retail">Retail</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="education">Education</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="companySize" className="block text-sm font-medium mb-1">
          Company Size
        </label>
        <select
          id="companySize"
          {...register("companySize")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        >
          <option value="">Select company size</option>
          <option value="1-10">1-10 employees</option>
          <option value="11-50">11-50 employees</option>
          <option value="51-200">51-200 employees</option>
          <option value="201-500">201-500 employees</option>
          <option value="501+">501+ employees</option>
        </select>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center mb-6">Contact Details</h2>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
          Contact Email *
        </label>
        <input
          id="contactEmail"
          type="email"
          {...register("contactEmail")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.contactEmail && (
          <p className="text-red-600 text-sm mt-1">{errors.contactEmail.message}</p>
        )}
        <p className="text-[var(--muted-foreground)] text-xs mt-1">This email will be used for customer inquiries</p>
      </div>

      <div>
        <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">
          Contact Phone
        </label>
        <input
          id="contactPhone"
          type="tel"
          {...register("contactPhone")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium mb-1">
          Address
        </label>
        <input
          id="address"
          type="text"
          {...register("address")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-1">
            City
          </label>
          <input
            id="city"
            type="text"
            {...register("city")}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium mb-1">
            Country
          </label>
          <input
            id="country"
            type="text"
            {...register("country")}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="bg-[var(--surface)] p-8 rounded-lg shadow-md w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">Vendor Registration</h1>
        <p className="text-center text-[var(--muted-foreground)] mb-8">Step {currentStep} of 3</p>

        {renderStepIndicator()}

        {serverError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                disabled={isLoading}
                className="px-6 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--background)] disabled:opacity-50"
              >
                Previous
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={isLoading}
                className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="ml-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {isLoading ? "Submitting..." : "Submit Registration"}
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          <p>Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
