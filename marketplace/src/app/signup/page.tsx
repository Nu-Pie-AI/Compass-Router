"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import AuthForm from "@/components/auth/AuthForm";
import { getSafeAuthCallback } from "@/lib/auth-redirect";

export default function SignupPage() {
  return <Suspense fallback={null}><SignupContent /></Suspense>;
}

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const callbackUrl = getSafeAuthCallback(searchParams.get("callbackUrl"));

  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [callbackUrl, router, status]);

  if (status === "authenticated") {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Opening Compass...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Create Account</h1>
        <AuthForm mode="signup" callbackUrl={callbackUrl} />
        <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
          Already have an account?{" "}
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
