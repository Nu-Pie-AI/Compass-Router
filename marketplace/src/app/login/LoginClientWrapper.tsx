"use client";

import { useSearchParams } from "next/navigation";

export default function LoginClientWrapper({
  children,
}: {
  children: (callbackUrl: string) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  return <>{children(callbackUrl)}</>;
}