"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function PortalPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ portal: string }>("/auth/portal")
      .then(({ portal }) => { if (!cancelled) router.replace(portal === "super-admin" ? "/super-admin" : portal === "admin" ? "/admin" : "/dashboard"); })
      .catch(() => { if (!cancelled) router.replace("/login?callbackUrl=%2Fportal"); });
    return () => { cancelled = true; };
  }, [router]);
  return <main className="console-auth-loading">Opening your Compass workspace...</main>;
}
