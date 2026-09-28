'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast-helpers';

const partnerSignupSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid work email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    companyName: z.string().min(2, 'Company name is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PartnerSignupFormData = z.infer<typeof partnerSignupSchema>;

export default function PartnerRegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PartnerSignupFormData>({
    resolver: zodResolver(partnerSignupSchema),
  });

  const onSubmit = async (data: PartnerSignupFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch('/api/partners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || 'Registration failed');
        toastError('Registration failed', result.error || 'Please try again');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      toastSuccess('Partner account created', 'Your application is awaiting admin approval.');

      // Redirect to approval pending page after 2 seconds
      setTimeout(() => {
        router.push('/approval-pending');
      }, 2000);
    } catch (error) {
      setServerError('An unexpected error occurred. Please try again.');
      toastError('Registration failed', 'Please try again.');
      setIsLoading(false);
    }
  };

  const oauthCallbackUrl = '/partners/register/complete';

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[var(--background)]">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-[var(--background)] to-purple-500/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_50%)]"></div>

        <div className="relative z-10 max-w-md w-full text-center">
          <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Account Created!</h2>
            <p className="text-[var(--muted-foreground)] mb-4">
              Your partner account has been submitted for review.
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Redirecting to approval status page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-[var(--background)]">
      {/* Modern gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-[var(--background)] to-purple-500/5"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_50%)]"></div>

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl"></div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
            Become a Partner
          </h1>
          <p className="text-lg text-[var(--muted-foreground)]">
            Join our marketplace and reach thousands of SMBs
          </p>
        </div>

        {/* Form card */}
        <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                {serverError}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                {...register('name')}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all"
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="text-red-600 text-sm mt-1.5">{errors.name.message}</p>
              )}
            </div>

            {/* Work Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all"
                placeholder="john@company.com"
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1.5">{errors.email.message}</p>
              )}
            </div>

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                {...register('companyName')}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all"
                placeholder="Your Company Inc."
              />
              {errors.companyName && (
                <p className="text-red-600 text-sm mt-1.5">{errors.companyName.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 text-sm mt-1.5">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Partner Account</span>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs uppercase text-[var(--muted-foreground)]">or</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: oauthCallbackUrl })}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => signIn('azure-ad', { callbackUrl: oauthCallbackUrl })}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Continue with Microsoft
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-[var(--muted-foreground)] hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-[var(--muted-foreground)] hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
