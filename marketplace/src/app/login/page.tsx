'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import LoginClientWrapper from './LoginClientWrapper';
import { toastError, toastSuccess } from '@/lib/toast-helpers';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClientWrapper>
        {(callbackUrl) => <LoginForm callbackUrl={callbackUrl} />}
      </LoginClientWrapper>
    </Suspense>
  );
}

function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.startsWith('TWO_FACTOR_REQUIRED')) {
          const [, challengeId, method, userId] = result.error.split(':');
          router.push(`/two-factor/verify?challengeId=${encodeURIComponent(challengeId || '')}&method=${encodeURIComponent(method || 'TOTP')}&userId=${encodeURIComponent(userId || '')}`);
          return;
        }

        setServerError('Invalid email or password');
        toastError('Login failed', 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      const sessionResponse = await fetch('/api/auth/session');
      const session = await sessionResponse.json();

      if (!session?.user) {
        setServerError('Failed to load session');
        toastError('Login failed', 'Failed to load session');
        setIsLoading(false);
        return;
      }

      toastSuccess('Logged in successfully');
      const role = session.user.role;

      if (role === 'partner') {
        const approvalResponse = await fetch('/api/partners/approval-status');
        const approvalData = await approvalResponse.json();

        if (
          approvalData.approvalStatus === 'PENDING' ||
          approvalData.approvalStatus === 'REJECTED'
        ) {
          router.push('/approval-pending');
          return;
        }

        const partnerResponse = await fetch('/api/partners/me');
        const partnerData = await partnerResponse.json();

        if (partnerData.onboardingStatus === 'IN_PROGRESS') {
          router.push('/partners/offerings/create-ai');
        } else {
          router.push('/partners/dashboard');
        }
        return;
      }

      if (role === 'admin' || role === 'super_admin') {
        router.push('/admin');
        return;
      }

      if (role === 'vendor') {
        router.push('/vendors/dashboard');
        return;
      }

      router.push(callbackUrl);
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
      toastError('Login failed', 'Please try again.');
      setIsLoading(false);
    }
  };

  const oauthSignIn = (provider: 'google' | 'azure-ad') => {
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-[var(--background)]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-[var(--background)] to-purple-500/5"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
            Welcome Back
          </h1>
          <p className="text-lg text-[var(--muted-foreground)]">
            Log in to access your account
          </p>
        </div>

        <div className="bg-[var(--surface)]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[var(--border)]/50 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Email Address
              </label>
              <input
                type="email"
                {...register('email')}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all"
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1.5">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-[var(--muted-foreground)]">
                  Password
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-[var(--background)] disabled:cursor-not-allowed transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="text-red-600 text-sm mt-1.5">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log In'
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
              onClick={() => oauthSignIn('google')}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => oauthSignIn('azure-ad')}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Continue with Microsoft
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm text-[var(--muted-foreground)]">
            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
              Forgot password?
            </Link>
            <span>
            Don&apos;t have an account?{' '}
            <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
              Sign up
            </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
