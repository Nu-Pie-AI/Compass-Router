"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getSafeAuthCallback } from "@/lib/auth-redirect";

export default function LoginClientWrapper({
  children,
}: {
  children: (callbackUrl: string) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const callbackUrl = getSafeAuthCallback(searchParams.get("callbackUrl"));

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace(callbackUrl);
  }, [callbackUrl, router, status]);

  if (status === "authenticated") {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Opening Compass...</div>;
  }

  return <>{children(callbackUrl)}</>;
}
